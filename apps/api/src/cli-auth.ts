import { createHash, randomBytes } from "node:crypto";

export interface CliAuthCodeEntry {
  state: string;
  sessionToken: string;
  email: string;
  expiresAt: number;
}

const CLI_AUTH_CODE_TTL_MS = 2 * 60_000;
const store = new Map<string, CliAuthCodeEntry>();

function purgeExpired(): void {
  const now = Date.now();
  for (const [code, entry] of store) {
    if (entry.expiresAt <= now) {
      store.delete(code);
    }
  }
}

export function createCliAuthCode(input: {
  state: string;
  sessionToken: string;
  email: string;
}): string {
  purgeExpired();
  const code = randomBytes(32).toString("base64url");
  store.set(code, {
    state: input.state,
    sessionToken: input.sessionToken,
    email: input.email,
    expiresAt: Date.now() + CLI_AUTH_CODE_TTL_MS
  });
  return code;
}

export function consumeCliAuthCode(code: string, state: string): CliAuthCodeEntry | undefined {
  purgeExpired();
  const entry = store.get(code);
  if (!entry || entry.state !== state || entry.expiresAt <= Date.now()) {
    return undefined;
  }
  store.delete(code);
  return entry;
}

export function parseSessionTokenFromCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith("better-auth.session_token=")) {
      return decodeURIComponent(trimmed.slice("better-auth.session_token=".length));
    }
  }

  return undefined;
}

export function hashCliAuthCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
