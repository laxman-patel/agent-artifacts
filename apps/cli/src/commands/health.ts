import type { CommandSpec } from "../command-spec.js";

export const healthCommand: CommandSpec = {
  name: "health",
  description: "Check API health",
  http: { method: "GET", pathTemplate: "/health" },
  mutates: false,
  example: "artifacts health",
  async run({ client }) {
    const data = await client.get<{ ok: boolean }>("/health");
    return { data };
  }
};
