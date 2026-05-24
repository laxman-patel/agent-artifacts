import type { CommandSpec } from "../command-spec.js";

export const auditListCommand: CommandSpec = {
  name: "audit list",
  description: "List audit events",
  options: [
    { flag: "--artifact-id <id>", description: "Filter by artifact" },
    { flag: "--limit <n>", description: "Max events", parse: (v) => Number.parseInt(v, 10) }
  ],
  http: { method: "GET", pathTemplate: "/api/audit-events" },
  mutates: false,
  example: "artifacts audit list --artifact-id ARTIFACT_ID --limit 50",
  async run({ client, options }) {
    const data = await client.get("/api/audit-events", {
      artifactId: options.artifactId as string | undefined,
      limit: options.limit as number | undefined
    });
    return { data };
  }
};
