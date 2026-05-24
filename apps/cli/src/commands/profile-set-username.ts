import { z } from "zod";
import type { CommandSpec } from "../command-spec.js";

export const usernameBodySchema = z.object({ username: z.string().min(1) });

export const profileSetUsernameCommand: CommandSpec = {
  name: "profile set-username",
  description: "Set username once for a new account",
  options: [
    { flag: "--json <payload>", description: 'JSON e.g. {"username":"alice"}', required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: usernameBodySchema,
  http: { method: "POST", pathTemplate: "/api/profile/username" },
  mutates: true,
  example: 'artifacts profile set-username --json \'{"username":"alice"}\'',
  async run({ client, body }) {
    const data = await client.post("/api/profile/username", usernameBodySchema.parse(body));
    return { data };
  }
};
