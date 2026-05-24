import type { CommandSpec } from "../command-spec.js";
import { CliError } from "../errors.js";

export const whoamiCommand: CommandSpec = {
  name: "whoami",
  description: "Show the current authenticated user",
  http: { method: "GET", pathTemplate: "/api/profile/me" },
  mutates: false,
  example: "artifacts whoami",
  async run({ config, client }) {
    if (!config.token) {
      throw new CliError("forbidden", "Not signed in. Run `artifacts login` first.", 4);
    }
    const data = await client.get("/api/profile/me");
    return { data };
  }
};
