import type { CommandSpec } from "../command-spec.js";

export const healthCommand: CommandSpec = {
  name: "health",
  description: "Check that the API is reachable",
  http: { method: "GET", pathTemplate: "/api/health" },
  mutates: false,
  example: "artifacts health",
  async run({ client, config }) {
    await client.get<{ ok?: boolean }>("/api/health");
    if (config.format === "text") {
      return { data: "ok", emitRawText: true };
    }
    return { data: { ok: true } };
  }
};
