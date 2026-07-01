import { resolveAuthState } from "../auth/state.js";
import type { CommandSpec } from "../command-spec.js";
import type { NextAction } from "../output.js";

export const statusCommand: CommandSpec = {
  name: "status",
  description: "Show local auth and configuration state (no network call)",
  mutates: false,
  example: "artifacts status",
  async run({ config }) {
    const auth = resolveAuthState(config);
    const nextActions: NextAction[] = auth.authenticated
      ? [{ command: "artifacts whoami", description: "Confirm the signed-in account against the API" }]
      : [{ command: "artifacts login", description: "Sign in via browser and persist credentials locally" }];

    return {
      data: {
        authenticated: auth.authenticated,
        tokenSource: auth.tokenSource,
        email: auth.email,
        baseUrl: config.baseUrl,
        webUrl: config.webUrl,
        credentialsPath: auth.credentialsPath
      },
      nextActions
    };
  }
};
