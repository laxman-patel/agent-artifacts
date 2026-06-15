import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredCredentials {
  baseUrl: string;
  webUrl: string;
  token: string;
  apiKeyId?: string;
  email?: string;
  updatedAt: string;
}

interface CredentialMetadata {
  baseUrl: string;
  webUrl: string;
  apiKeyId?: string;
  email?: string;
  updatedAt: string;
}

interface SecretStore {
  id: string;
  load(): string | null;
  save(token: string): void;
  clear(): boolean;
}

const SECRET_SERVICE = "agent-artifacts-cli";
const SECRET_ACCOUNT = "default";
const SECRET_LABEL = "Agent Artifacts CLI credentials";
const TEST_SECRET_STORE = "file";
const TEST_SECRET_FILE = "credentials.secret";
const WINDOWS_CREDENTIAL_TARGET = `${SECRET_SERVICE}:${SECRET_ACCOUNT}`;

const WINDOWS_CREDENTIAL_SCRIPT = String.raw`
$ErrorActionPreference = "Stop"
$Action = $args[0]
$Target = $args[1]
$Secret = [Environment]::GetEnvironmentVariable("AGENT_ARTIFACTS_SECRET_VALUE")

$Code = @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class AgentArtifactsCredentialManager {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public uint Flags;
    public uint Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public uint CredentialBlobSize;
    public IntPtr CredentialBlob;
    public uint Persist;
    public uint AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredWrite(ref CREDENTIAL credential, uint flags);

  [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredRead(string target, uint type, uint reservedFlag, out IntPtr credentialPtr);

  [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool CredDelete(string target, uint type, uint flags);

  [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
  public static extern void CredFree(IntPtr buffer);

  private const uint CredTypeGeneric = 1;
  private const uint CredPersistLocalMachine = 2;

  public static void Write(string target, string secret) {
    byte[] secretBytes = Encoding.Unicode.GetBytes(secret);
    if (secretBytes.Length > 5120) {
      throw new InvalidOperationException("Credential is too large for Windows Credential Manager.");
    }

    IntPtr secretBlob = Marshal.AllocCoTaskMem(secretBytes.Length);
    try {
      Marshal.Copy(secretBytes, 0, secretBlob, secretBytes.Length);
      CREDENTIAL credential = new CREDENTIAL {
        Type = CredTypeGeneric,
        TargetName = target,
        CredentialBlobSize = (uint)secretBytes.Length,
        CredentialBlob = secretBlob,
        Persist = CredPersistLocalMachine,
        UserName = "agent-artifacts"
      };

      if (!CredWrite(ref credential, 0)) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }
    } finally {
      Marshal.FreeCoTaskMem(secretBlob);
    }
  }

  public static string Read(string target) {
    IntPtr credentialPtr;
    if (!CredRead(target, CredTypeGeneric, 0, out credentialPtr)) {
      return null;
    }

    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
      return Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
    } finally {
      CredFree(credentialPtr);
    }
  }

  public static bool Delete(string target) {
    return CredDelete(target, CredTypeGeneric, 0);
  }
}
"@

Add-Type -TypeDefinition $Code

switch ($Action) {
  "read" {
    $Value = [AgentArtifactsCredentialManager]::Read($Target)
    if ($null -eq $Value) {
      exit 1
    }
    [Console]::Out.Write($Value)
  }
  "write" {
    [AgentArtifactsCredentialManager]::Write($Target, $Secret)
  }
  "delete" {
    if (-not [AgentArtifactsCredentialManager]::Delete($Target)) {
      exit 1
    }
  }
  default {
    throw "Unknown credential action: $Action"
  }
}
`;

export function credentialsPath(): string {
  return metadataPath();
}

export function loadStoredCredentials(): StoredCredentials | null {
  const path = metadataPath();
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<StoredCredentials & CredentialMetadata>;
    const metadata = parseCredentialMetadata(parsed);
    if (!metadata) {
      return null;
    }

    const store = createSecretStore();
    const token = store.load();
    if (token) {
      return toStoredCredentials(metadata, token);
    }

    if (typeof parsed.token === "string") {
      store.save(parsed.token);
      writeCredentialMetadata(metadata, store.id);
      return toStoredCredentials(metadata, parsed.token);
    }

    return null;
  } catch {
    return null;
  }
}

export function saveStoredCredentials(credentials: StoredCredentials): void {
  const store = createSecretStore();
  store.save(credentials.token);
  writeCredentialMetadata(credentials, store.id);
}

export function clearStoredCredentials(): boolean {
  let removed = false;
  try {
    removed = createSecretStore().clear() || removed;
  } catch {
    // Removing the metadata file still signs the local CLI out if the OS store is unavailable.
  }

  const path = metadataPath();
  if (existsSync(path)) {
    unlinkSync(path);
    removed = true;
  }
  return removed;
}

function configDir(): string {
  return process.env.AGENT_ARTIFACTS_CONFIG_DIR ?? join(homedir(), ".config", "agent-artifacts");
}

function metadataPath(): string {
  return join(configDir(), "credentials.json");
}

function parseCredentialMetadata(parsed: Partial<StoredCredentials & CredentialMetadata>): CredentialMetadata | null {
  if (typeof parsed.baseUrl !== "string") {
    return null;
  }

  return {
    baseUrl: parsed.baseUrl,
    webUrl: typeof parsed.webUrl === "string" ? parsed.webUrl : "http://localhost:3000",
    apiKeyId: typeof parsed.apiKeyId === "string" ? parsed.apiKeyId : undefined,
    email: typeof parsed.email === "string" ? parsed.email : undefined,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
  };
}

function toStoredCredentials(metadata: CredentialMetadata, token: string): StoredCredentials {
  const credentials: StoredCredentials = {
    baseUrl: metadata.baseUrl,
    webUrl: metadata.webUrl,
    token,
    updatedAt: metadata.updatedAt
  };

  if (metadata.apiKeyId) {
    credentials.apiKeyId = metadata.apiKeyId;
  }
  if (metadata.email) {
    credentials.email = metadata.email;
  }

  return credentials;
}

function writeCredentialMetadata(credentials: CredentialMetadata, store: string): void {
  mkdirSync(configDir(), { recursive: true });
  const metadata: CredentialMetadata & { store: string } = {
    baseUrl: credentials.baseUrl,
    webUrl: credentials.webUrl,
    apiKeyId: credentials.apiKeyId,
    email: credentials.email,
    updatedAt: credentials.updatedAt,
    store
  };
  writeFileSync(metadataPath(), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600 });
}

function createSecretStore(): SecretStore {
  if (process.env.AGENT_ARTIFACTS_INSECURE_TEST_CREDENTIAL_STORE === TEST_SECRET_STORE) {
    return createTestFileSecretStore();
  }

  switch (process.platform) {
    case "linux":
      return createSecretToolStore();
    case "darwin":
      return createMacOsKeychainStore();
    case "win32":
      return createWindowsCredentialManagerStore();
    default:
      throw new Error(`Secure credential storage is not supported on ${process.platform}.`);
  }
}

function runCredentialCommand(
  command: string,
  args: string[],
  options: { input?: string; env?: NodeJS.ProcessEnv; missingOk?: boolean; unavailableMessage: string }
): string | null {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input: options.input,
    env: options.env
  });

  if (result.error) {
    throw new Error(`${options.unavailableMessage} (${result.error.message})`);
  }

  if (result.status !== 0) {
    if (options.missingOk) {
      return null;
    }
    const stderr = result.stderr.trim();
    throw new Error(stderr || options.unavailableMessage);
  }

  return result.stdout;
}

function createSecretToolStore(): SecretStore {
  const unavailableMessage =
    "Could not access secret-tool. Install libsecret's secret-tool and unlock your Linux keyring, then run `artifacts login` again.";

  return {
    id: "secret-tool",
    load() {
      return runCredentialCommand("secret-tool", ["lookup", "service", SECRET_SERVICE, "account", SECRET_ACCOUNT], {
        missingOk: true,
        unavailableMessage
      });
    },
    save(token) {
      runCredentialCommand(
        "secret-tool",
        ["store", "--label", SECRET_LABEL, "service", SECRET_SERVICE, "account", SECRET_ACCOUNT],
        {
          input: token,
          unavailableMessage
        }
      );
    },
    clear() {
      return (
        runCredentialCommand("secret-tool", ["clear", "service", SECRET_SERVICE, "account", SECRET_ACCOUNT], {
          missingOk: true,
          unavailableMessage
        }) !== null
      );
    }
  };
}

function createMacOsKeychainStore(): SecretStore {
  const unavailableMessage = "Could not access the macOS Keychain with the `security` command.";

  return {
    id: "macos-keychain",
    load() {
      return runCredentialCommand("security", ["find-generic-password", "-s", SECRET_SERVICE, "-a", SECRET_ACCOUNT, "-w"], {
        missingOk: true,
        unavailableMessage
      });
    },
    save(token) {
      runCredentialCommand(
        "security",
        ["add-generic-password", "-U", "-s", SECRET_SERVICE, "-a", SECRET_ACCOUNT, "-l", SECRET_LABEL, "-w", token],
        { unavailableMessage }
      );
    },
    clear() {
      return (
        runCredentialCommand("security", ["delete-generic-password", "-s", SECRET_SERVICE, "-a", SECRET_ACCOUNT], {
          missingOk: true,
          unavailableMessage
        }) !== null
      );
    }
  };
}

function createWindowsCredentialManagerStore(): SecretStore {
  const unavailableMessage = "Could not access Windows Credential Manager with PowerShell.";

  function runPowerShell(action: "read" | "write" | "delete", token?: string): string | null {
    return runCredentialCommand(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_CREDENTIAL_SCRIPT,
        action,
        WINDOWS_CREDENTIAL_TARGET
      ],
      {
        env: { ...process.env, AGENT_ARTIFACTS_SECRET_VALUE: token ?? "" },
        missingOk: action !== "write",
        unavailableMessage
      }
    );
  }

  return {
    id: "windows-credential-manager",
    load() {
      return runPowerShell("read");
    },
    save(token) {
      runPowerShell("write", token);
    },
    clear() {
      return runPowerShell("delete") !== null;
    }
  };
}

function createTestFileSecretStore(): SecretStore {
  const secretPath = join(configDir(), TEST_SECRET_FILE);
  return {
    id: "test-file",
    load() {
      if (!existsSync(secretPath)) {
        return null;
      }
      return readFileSync(secretPath, "utf8");
    },
    save(token) {
      mkdirSync(configDir(), { recursive: true });
      writeFileSync(secretPath, token, { mode: 0o600 });
    },
    clear() {
      if (!existsSync(secretPath)) {
        return false;
      }
      unlinkSync(secretPath);
      return true;
    }
  };
}
