import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface StoredCredentials {
  baseUrl: string;
  webUrl: string;
  token: string;
  email?: string;
  updatedAt: string;
}

const CONFIG_DIR = join(homedir(), ".config", "agent-artifacts");
const CREDENTIALS_PATH = join(CONFIG_DIR, "credentials.json");

export function credentialsPath(): string {
  return CREDENTIALS_PATH;
}

export function loadStoredCredentials(): StoredCredentials | null {
  if (!existsSync(CREDENTIALS_PATH)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as Partial<StoredCredentials>;
    if (typeof parsed.baseUrl !== "string" || typeof parsed.token !== "string") {
      return null;
    }

    return {
      baseUrl: parsed.baseUrl,
      webUrl: typeof parsed.webUrl === "string" ? parsed.webUrl : "http://localhost:3000",
      token: parsed.token,
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function saveStoredCredentials(credentials: StoredCredentials): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CREDENTIALS_PATH, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
}

export function clearStoredCredentials(): void {
  if (existsSync(CREDENTIALS_PATH)) {
    unlinkSync(CREDENTIALS_PATH);
  }
}
