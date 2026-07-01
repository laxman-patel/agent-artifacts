import { resolveAuthState, type AuthState } from "../auth/state.js";
import type { CommandSpec } from "../command-spec.js";
import { CliError } from "../errors.js";
import type { NextAction } from "../output.js";
import { readCliVersion } from "../version.js";

interface ErrorInfo {
  kind: string;
  message: string;
}

interface Identity {
  username: string | null;
  email: string | null;
  name: string | null;
}

/**
 * `doctor` is the single command an agent runs when a call fails and it needs to
 * understand why. It collapses the old health + status + whoami sequence into one
 * invocation and one JSON report, and it never throws for an expected failure
 * (unauthenticated, unreachable, rejected token) — the report describes the
 * problem instead so the agent can branch on data rather than exit codes.
 */
export const doctorCommand: CommandSpec = {
  name: "doctor",
  description: "One-shot diagnostic: CLI version, auth state, API reachability, and identity (single command)",
  mutates: false,
  example: "artifacts doctor",
  async run({ config, client }) {
    const auth = resolveAuthState(config);
    let apiReachable = false;
    let apiError: string | undefined;
    let checkedVia: "whoami" | "health";
    let identity: Identity | null = null;
    let identityError: ErrorInfo | undefined;

    if (auth.authenticated) {
      checkedVia = "whoami";
      try {
        const me = await client.get<Record<string, unknown>>("/api/profile/me");
        apiReachable = true;
        identity = extractIdentity(me);
      } catch (error) {
        const info = describeError(error);
        // A network failure means the API is unreachable. Any structured error
        // (auth, forbidden, ...) still proves the API answered, so reachability
        // is true but identity resolution failed.
        if (info.kind === "network") {
          apiError = info.message;
        } else {
          apiReachable = true;
          identityError = info;
        }
      }
    } else {
      checkedVia = "health";
      try {
        await client.get("/api/health");
        apiReachable = true;
      } catch (error) {
        apiError = describeError(error).message;
      }
    }

    const healthy = auth.authenticated && apiReachable && identity !== null && identityError === undefined;

    return {
      data: {
        healthy,
        cli: { version: readCliVersion() },
        baseUrl: config.baseUrl,
        webUrl: config.webUrl,
        credentialsPath: auth.credentialsPath,
        auth: {
          authenticated: auth.authenticated,
          tokenSource: auth.tokenSource,
          email: auth.email
        },
        api: {
          reachable: apiReachable,
          checkedVia,
          ...(apiError ? { error: apiError } : {})
        },
        identity,
        ...(identityError ? { identityError } : {})
      },
      nextActions: buildNextActions({ auth, apiReachable, identityError })
    };
  }
};

function extractIdentity(me: Record<string, unknown>): Identity {
  const profile = (me.profile ?? {}) as Record<string, unknown>;
  const user = (me.user ?? {}) as Record<string, unknown>;
  const username = typeof profile.username === "string" ? profile.username : null;
  const email = typeof user.email === "string" ? user.email : null;
  const name =
    typeof user.name === "string"
      ? user.name
      : typeof profile.displayName === "string"
        ? profile.displayName
        : null;
  return { username, email, name };
}

function describeError(error: unknown): ErrorInfo {
  if (error instanceof CliError) {
    return { kind: error.kind, message: error.message };
  }
  return { kind: "unknown", message: error instanceof Error ? error.message : String(error) };
}

function buildNextActions(state: {
  auth: AuthState;
  apiReachable: boolean;
  identityError: ErrorInfo | undefined;
}): NextAction[] {
  if (!state.auth.authenticated) {
    return [
      { command: "artifacts login", description: "Sign in via browser and persist credentials locally" },
      {
        command: "export AGENT_ARTIFACTS_TOKEN=aa_k_...",
        description: "Or authenticate non-interactively with an API key"
      }
    ];
  }
  if (state.identityError && (state.identityError.kind === "auth" || state.identityError.kind === "forbidden")) {
    return [{ command: "artifacts login", description: "Stored credentials were rejected — sign in again" }];
  }
  if (!state.apiReachable) {
    return [
      {
        command: "artifacts doctor --base-url https://hostartifacts.dev",
        description: "Re-check against the production API base URL"
      }
    ];
  }
  return [
    {
      command: "artifacts push --project-slug default --file ./report.md",
      description: "Everything checks out — publish a file"
    }
  ];
}
