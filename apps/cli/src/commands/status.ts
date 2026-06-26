import { credentialsPath, loadStoredCredentials } from "../auth/credentials.js";
import type { CommandSpec } from "../command-spec.js";
import type { NextAction } from "../output.js";

type TokenSource = "none" | "env" | "login" | "flag";

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

export const statusCommand: CommandSpec = {
  name: "status",
  description: "Show local auth and configuration state (no network call)",
  mutates: false,
  example: "artifacts status",
  async run({ config }) {
    const stored = loadStoredCredentials();
    const authenticated = Boolean(config.token);
    const nextActions: NextAction[] = authenticated
      ? [{ command: "artifacts whoami", description: "Confirm the signed-in account against the API" }]
      : [{ command: "artifacts login", description: "Sign in via browser and persist credentials locally" }];

    return {
      data: {
        authenticated,
        tokenSource: tokenSource(config.token, stored?.token),
        email: stored?.email ?? null,
        baseUrl: config.baseUrl,
        webUrl: config.webUrl,
        credentialsPath: credentialsPath()
      },
      nextActions
    };
  }
};
