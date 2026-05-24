import type { CommandSpec } from "../command-spec.js";

export const profileGetCommand: CommandSpec = {
  name: "profile get",
  description: "Get authenticated user and profile",
  http: { method: "GET", pathTemplate: "/api/profile/me" },
  mutates: false,
  example: "artifacts profile get",
  async run({ client }) {
    const data = await client.get("/api/profile/me");
    return { data };
  }
};
