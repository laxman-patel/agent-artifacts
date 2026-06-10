import { loadStoredCredentials, clearStoredCredentials, credentialsPath } from "../auth/credentials.js";
import type { CommandSpec } from "../command-spec.js";

export const logoutCommand: CommandSpec = {
  name: "logout",
  description: "Remove locally stored credentials",
  mutates: true,
  example: "artifacts logout",
  async run({ client }) {
    const credentials = loadStoredCredentials();
    let revoked = false;
    let revokeError: string | undefined;
    if (credentials?.apiKeyId) {
      try {
        await client.delete(`/api/api-keys/${encodeURIComponent(credentials.apiKeyId)}`);
        revoked = true;
      } catch (error) {
        revokeError = error instanceof Error ? error.message : String(error);
      }
    }
    const wasSignedIn = clearStoredCredentials();
    return { data: { loggedOut: true, wasSignedIn, revoked, revokeError, credentialsPath: credentialsPath() } };
  }
};
