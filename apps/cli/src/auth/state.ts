import type { CliConfig } from "../config.js";
import { credentialsPath, loadStoredCredentials } from "./credentials.js";

export type TokenSource = "none" | "env" | "login" | "flag";

export interface AuthState {
  authenticated: boolean;
  tokenSource: TokenSource;
  email: string | null;
  credentialsPath: string;
}

function tokenSource(token: string | undefined, storedToken: string | undefined): TokenSource {
  if (!token) {
    return "none";
  }
  if (process.env.AGENT_ARTIFACTS_TOKEN && process.env.AGENT_ARTIFACTS_TOKEN === token) {
    return "env";
  }
  if (storedToken && storedToken === token) {
    return "login";
  }
  return "flag";
}

/**
 * Resolves the local authentication picture without any network call. Shared by
 * `status` (pure local report) and `doctor` (local report + one liveness call).
 */
export function resolveAuthState(config: CliConfig): AuthState {
  const stored = loadStoredCredentials();
  return {
    authenticated: Boolean(config.token),
    tokenSource: tokenSource(config.token, stored?.token),
    email: stored?.email ?? null,
    credentialsPath: credentialsPath()
  };
}
