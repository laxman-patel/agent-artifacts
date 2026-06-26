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

const FILE_MODE = 0o600;
const DIR_MODE = 0o700;

/**
 * Credentials live in a single 0600 JSON file under the config directory. This
 * mirrors how `gh`, `npm`, `aws`, and `vercel` persist tokens: a restricted
 * local file works everywhere — headless servers, containers, CI, SSH sessions,
 * and AI agents — without depending on an unlocked OS keyring or a D-Bus session.
 */
export function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

export function loadStoredCredentials(): StoredCredentials | null {
  const path = credentialsPath();
  if (!existsSync(path)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<StoredCredentials>;
    if (typeof parsed.baseUrl !== "string" || typeof parsed.token !== "string" || parsed.token.length === 0) {
      return null;
    }

    const credentials: StoredCredentials = {
      baseUrl: parsed.baseUrl,
      webUrl: typeof parsed.webUrl === "string" ? parsed.webUrl : parsed.baseUrl,
      token: parsed.token,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
    if (typeof parsed.apiKeyId === "string") {
      credentials.apiKeyId = parsed.apiKeyId;
    }
    if (typeof parsed.email === "string") {
      credentials.email = parsed.email;
    }
    return credentials;
  } catch {
    return null;
  }
}

export function saveStoredCredentials(credentials: StoredCredentials): void {
  mkdirSync(configDir(), { recursive: true, mode: DIR_MODE });

  const payload: StoredCredentials = {
    baseUrl: credentials.baseUrl,
    webUrl: credentials.webUrl,
    token: credentials.token,
    updatedAt: credentials.updatedAt
  };
  if (credentials.apiKeyId) {
    payload.apiKeyId = credentials.apiKeyId;
  }
  if (credentials.email) {
    payload.email = credentials.email;
  }

  writeFileSync(credentialsPath(), `${JSON.stringify(payload, null, 2)}\n`, { mode: FILE_MODE });
}

export function clearStoredCredentials(): boolean {
  const path = credentialsPath();
  if (!existsSync(path)) {
    return false;
  }
  unlinkSync(path);
  return true;
}

function configDir(): string {
  return process.env.AGENT_ARTIFACTS_CONFIG_DIR ?? join(homedir(), ".config", "agent-artifacts");
}
