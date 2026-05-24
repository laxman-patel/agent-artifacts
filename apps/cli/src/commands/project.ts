import { createProjectInputSchema } from "@agent-artifacts/artifact";
import { requirePositional } from "../args.js";
import type { CommandSpec } from "../command-spec.js";
import { nextActionsForProject } from "../next-actions.js";

export const projectListCommand: CommandSpec = {
  name: "project list",
  description: "List owned projects",
  http: { method: "GET", pathTemplate: "/api/profile/projects" },
  mutates: false,
  example: "artifacts project list",
  async run({ client }) {
    const data = await client.get("/api/profile/projects");
    return { data };
  }
};

export const projectCreateCommand: CommandSpec = {
  name: "project create",
  description: "Create a project",
  options: [
    { flag: "--json <payload>", description: "JSON body", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: createProjectInputSchema,
  http: { method: "POST", pathTemplate: "/api/projects" },
  mutates: true,
  example: 'artifacts project create --json \'{"ownerUsername":"alice","slug":"my-app","title":"My App"}\'',
  async run({ client, body }) {
    const data = await client.post("/api/projects", createProjectInputSchema.parse(body));
    return { data, nextActions: nextActionsForProject(data) };
  }
};

export const projectSlugAvailabilityCommand: CommandSpec = {
  name: "project slug-availability",
  description: "Check project slug availability",
  positional: [
    { name: "owner", required: true },
    { name: "slug", required: true }
  ],
  http: { method: "GET", pathTemplate: "/api/projects/slug-availability/{ownerUsername}/{slug}" },
  mutates: false,
  example: "artifacts project slug-availability alice my-app",
  async run({ client, positionals }) {
    const owner = requirePositional(positionals, 0, "owner", "artifacts project slug-availability alice my-app");
    const slug = requirePositional(positionals, 1, "slug", "artifacts project slug-availability alice my-app");
    const data = await client.get(
      `/api/projects/slug-availability/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`
    );
    return { data };
  }
};
