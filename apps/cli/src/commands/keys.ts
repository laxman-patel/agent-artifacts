import { CliError } from "../errors.js";
import type { CommandSpec } from "../command-spec.js";

const VALID_SCOPES = new Set([
  "artifacts:read",
  "artifacts:create",
  "artifacts:update",
  "artifacts:delete",
  "artifacts:share",
  "artifacts:access:read",
  "artifacts:access:write",
  "agents:manage"
]);

function parseScopes(value: unknown): string[] {
  const raw = typeof value === "string" && value.trim().length > 0
    ? value.split(",").map((scope) => scope.trim()).filter(Boolean)
    : ["artifacts:read", "artifacts:create", "artifacts:update"];
  const invalid = raw.filter((scope) => !VALID_SCOPES.has(scope));
  if (invalid.length > 0) {
    throw new CliError("invalid_request", `Unknown scope: ${invalid.join(", ")}`, 2);
  }
  return raw;
}

export const keysListCommand: CommandSpec = {
  name: "keys list",
  description: "List API keys",
  http: { method: "GET", pathTemplate: "/api/api-keys" },
  mutates: false,
  example: "artifacts keys list",
  async run({ client }) {
    return { data: await client.get("/api/api-keys") };
  }
};

export const keysCreateCommand: CommandSpec = {
  name: "keys create",
  description: "Create a scoped API key",
  options: [
    { flag: "--name <name>", description: "Key name", required: true },
    { flag: "--scopes <scopes>", description: "Comma-separated scopes" }
  ],
  http: { method: "POST", pathTemplate: "/api/api-keys" },
  mutates: true,
  example: "artifacts keys create --name ci --scopes artifacts:read,artifacts:create",
  async run({ client, options }) {
    const name = String(options.name ?? "").trim();
    if (!name) {
      throw new CliError("invalid_request", "--name is required.", 2);
    }
    return {
      data: await client.post("/api/api-keys", {
        name,
        scopes: parseScopes(options.scopes)
      })
    };
  }
};

export const keysRevokeCommand: CommandSpec = {
  name: "keys revoke",
  description: "Revoke an API key",
  options: [{ flag: "--api-key-id <id>", description: "API key id", required: true }],
  http: { method: "DELETE", pathTemplate: "/api/api-keys/{apiKeyId}" },
  mutates: true,
  example: "artifacts keys revoke --api-key-id KEY_ID",
  async run({ client, options }) {
    const apiKeyId = String(options.apiKeyId ?? "");
    if (!apiKeyId) {
      throw new CliError("invalid_request", "--api-key-id is required.", 2);
    }
    return { data: await client.delete(`/api/api-keys/${encodeURIComponent(apiKeyId)}`) };
  }
};
