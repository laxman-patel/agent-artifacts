import { browserLogin } from "../auth/browser-login.js";
import { credentialsPath } from "../auth/credentials.js";
import type { CommandSpec } from "../command-spec.js";

export const loginCommand: CommandSpec = {
  name: "login",
  description: "Sign in via browser (stores credentials locally)",
  options: [{ flag: "--no-localhost", description: "Print URL instead of using a localhost callback (limited support)" }],
  mutates: true,
  example: "artifacts login",
  async run({ config, options }) {
    const result = await browserLogin({
      baseUrl: config.baseUrl,
      webUrl: config.webUrl,
      noLocalhost: options.noLocalhost as boolean | undefined,
      quiet: config.quiet
    });
    return {
      data: {
        email: result.credentials.email ?? null,
        baseUrl: result.credentials.baseUrl,
        webUrl: result.credentials.webUrl,
        credentialsPath: credentialsPath()
      }
    };
  }
};
