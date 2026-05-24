import { createProjectInputSchema } from "@agent-artifacts/artifact";
import { resolveResourceArg } from "../args.js";
import { LIST_LIMIT_OPTIONS, OWNER_OPTION, SLUG_OPTION } from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { resolveListLimit, sliceListResult } from "../list-limit.js";
import { nextActionsForProject } from "../next-actions.js";

const SLUG_EXAMPLE = "artifacts project slug-availability --owner alice --slug my-app";

export const projectListCommand: CommandSpec = {
  name: "project list",
  description: "List owned projects",
  options: LIST_LIMIT_OPTIONS,
  http: { method: "GET", pathTemplate: "/api/profile/projects" },
  mutates: false,
  example: "artifacts project list --limit 50",
  async run({ client, options, config }) {
    const limitResult = resolveListLimit(options);
    const data = await client.get<{ projects: unknown[] }>("/api/profile/projects");
    const projects = Array.isArray(data.projects) ? data.projects : [];
    const { items } = sliceListResult(projects, limitResult, config, "projects");
    return { data: { ...data, projects: items } };
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
    { name: "owner", required: false },
    { name: "slug", required: false }
  ],
  options: [OWNER_OPTION, SLUG_OPTION],
  http: { method: "GET", pathTemplate: "/api/projects/slug-availability/{ownerUsername}/{slug}" },
  mutates: false,
  example: SLUG_EXAMPLE,
  async run({ client, positionals, options }) {
    const owner = resolveResourceArg(positionals, options, {
      positionalIndex: 0,
      optionKey: "owner",
      label: "owner",
      flag: "--owner",
      example: SLUG_EXAMPLE
    });
    const slug = resolveResourceArg(positionals, options, {
      positionalIndex: 1,
      optionKey: "slug",
      label: "slug",
      flag: "--slug",
      example: SLUG_EXAMPLE
    });
    const data = await client.get(
      `/api/projects/slug-availability/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`
    );
    return { data };
  }
};
