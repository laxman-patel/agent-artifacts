import { clearStoredCredentials, credentialsPath } from "../auth/credentials.js";
import type { CommandSpec } from "../command-spec.js";

export const logoutCommand: CommandSpec = {
  name: "logout",
  description: "Remove locally stored credentials",
  mutates: true,
  example: "artifacts logout",
  async run() {
    const wasSignedIn = clearStoredCredentials();
    return { data: { loggedOut: true, wasSignedIn, credentialsPath: credentialsPath() } };
  }
};
