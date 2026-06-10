import { browserLogin } from "../auth/browser-login.js";
import { credentialsPath } from "../auth/credentials.js";
import type { CommandSpec } from "../command-spec.js";
import { CliError } from "../errors.js";

export const setupCommand: CommandSpec = {
  name: "setup",
  description: "Sign in and print MCP client configuration",
  mutates: true,
  example: "artifacts setup",
  async run({ config }) {
    let authState: "existing_credentials" | "browser_login" | "provided_token" = config.token
      ? "existing_credentials"
      : "browser_login";

    if (!config.token) {
      if (config.noInput) {
        throw new CliError(
          "invalid_request",
          "Setup requires credentials. Run `artifacts login` interactively or set AGENT_ARTIFACTS_TOKEN.",
          2
        );
      }

      await browserLogin({
        baseUrl: config.baseUrl,
        webUrl: config.webUrl,
        quiet: config.quiet
      });
    } else if (process.env.AGENT_ARTIFACTS_TOKEN) {
      authState = "provided_token";
    }

    const webUrl = config.webUrl.replace(/\/+$/, "");
    const serverUrl = `${webUrl}/mcp`;

    return {
      data: {
        status: "ready",
        auth: authState,
        apiBaseUrl: config.baseUrl,
        webUrl,
        credentialsPath: credentialsPath(),
        mcp: {
          serverUrl,
          protectedResourceMetadataUrl: `${webUrl}/.well-known/oauth-protected-resource`,
          authorizationServerMetadataUrl: `${webUrl}/.well-known/oauth-authorization-server`,
          clientConfig: {
            mcpServers: {
              "agent-artifacts": {
                url: serverUrl
              }
            }
          }
        },
        next: [
          "Paste mcp.clientConfig into your MCP client configuration.",
          "If your client supports OAuth discovery, use mcp.serverUrl and complete the browser consent flow."
        ]
      }
    };
  }
};
