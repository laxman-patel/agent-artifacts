import { clearStoredCredentials, credentialsPath } from "../auth/credentials.js";
import type { CommandSpec } from "../command-spec.js";

export const logoutCommand: CommandSpec = {
  name: "logout",
  description: "Remove locally stored credentials",
  mutates: true,
  example: "artifacts logout",
  async run() {
    clearStoredCredentials();
    return { data: { loggedOut: true, credentialsPath: credentialsPath() } };
  }
};
