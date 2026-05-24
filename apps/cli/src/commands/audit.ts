import { LIST_LIMIT_OPTIONS } from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { resolveListLimit } from "../list-limit.js";

export const auditListCommand: CommandSpec = {
  name: "audit list",
  description: "List audit events",
  options: [
    { flag: "--artifact-id <id>", description: "Filter by artifact" },
    ...LIST_LIMIT_OPTIONS
  ],
  http: { method: "GET", pathTemplate: "/api/audit-events" },
  mutates: false,
  example: "artifacts audit list --artifact-id ARTIFACT_ID --limit 50",
  async run({ client, options }) {
    const limitResult = resolveListLimit(options);
    const data = await client.get("/api/audit-events", {
      artifactId: options.artifactId as string | undefined,
      limit: limitResult.apiLimit
    });
    return { data };
  }
};
