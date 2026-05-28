import { createProjectInputSchema, createWorkspaceProjectInputSchema } from "@agent-artifacts/artifact";
import { requireFlag } from "../args.js";
import { LIST_LIMIT_OPTIONS, SLUG_OPTION } from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { CliError } from "../errors.js";
import { resolveListLimit, sliceListResult } from "../list-limit.js";
import { nextActionsForProject } from "../next-actions.js";
import { resolveWorkspaceId, workspaceApiPath } from "../workspace-context.js";

const SLUG_EXAMPLE = "artifacts project slug-availability --owner alice --slug my-app";
const WORKSPACE_SLUG_EXAMPLE = "artifacts --workspace acme project slug-availability --slug my-app";

export const projectListCommand: CommandSpec = {
  name: "project list",
  description: "List owned projects",
  options: LIST_LIMIT_OPTIONS,
  http: { method: "GET", pathTemplate: "/api/profile/projects" },
  mutates: false,
  example: "artifacts project list --limit 50",
  async run({ client, options, config }) {
    const limitResult = resolveListLimit(options);
    if (config.workspace) {
      const workspaceId = await resolveWorkspaceId(client, config.workspace);
      const data = await client.get<{ projects: unknown[] }>(workspaceApiPath(workspaceId, "/projects"));
      const projects = Array.isArray(data.projects) ? data.projects : [];
      const { items } = sliceListResult(projects, limitResult, config, "projects");
      return { data: { ...data, projects: items } };
    }

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
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" },
    { flag: "--ensure", description: "On slug conflict, return the existing project with created: false" }
  ],
  bodySchema: createProjectInputSchema,
  http: { method: "POST", pathTemplate: "/api/projects" },
  mutates: true,
  example: 'artifacts project create --json \'{"ownerUsername":"alice","slug":"my-app","title":"My App"}\'',
  async run({ client, body, options, config }) {
    if (config.workspace) {
      const workspaceId = await resolveWorkspaceId(client, config.workspace);
      const parsed = createWorkspaceProjectInputSchema.parse(body);
      try {
        const data = await client.post<Record<string, unknown>>(workspaceApiPath(workspaceId, "/projects"), parsed);
        return { data: { ...data, created: true }, nextActions: nextActionsForProject(data) };
      } catch (error) {
        if (options.ensure === true && error instanceof CliError && error.kind === "conflict") {
          const existing = await client.get<{ project: Record<string, unknown> }>(
            `/api/by-path/${encodeURIComponent(config.workspace)}/${encodeURIComponent(parsed.slug)}`
          );
          return {
            data: { ...existing.project, created: false },
            nextActions: nextActionsForProject(existing.project)
          };
        }
        throw error;
      }
    }

    const parsed = createProjectInputSchema.parse(body);
    try {
      const data = await client.post<Record<string, unknown>>("/api/projects", parsed);
      return { data: { ...data, created: true }, nextActions: nextActionsForProject(data) };
    } catch (error) {
      if (options.ensure === true && error instanceof CliError && error.kind === "conflict") {
        const existing = await client.get<{ project: Record<string, unknown> }>(
          `/api/by-path/${encodeURIComponent(parsed.ownerUsername)}/${encodeURIComponent(parsed.slug)}`
        );
        return {
          data: { ...existing.project, created: false },
          nextActions: nextActionsForProject(existing.project)
        };
      }
      throw error;
    }
  }
};

export const projectSlugAvailabilityCommand: CommandSpec = {
  name: "project slug-availability",
  description: "Check project slug availability",
  options: [
    { flag: "--owner <username>", description: "Owner username (personal namespace; omit when using --workspace)" },
    SLUG_OPTION
  ],
  http: { method: "GET", pathTemplate: "/api/projects/slug-availability/{ownerUsername}/{slug}" },
  mutates: false,
  example: SLUG_EXAMPLE,
  async run({ client, options, config }) {
    const slug = requireFlag(options, {
      optionKey: "slug",
      label: "slug",
      flag: "--slug",
      example: config.workspace ? WORKSPACE_SLUG_EXAMPLE : SLUG_EXAMPLE
    });

    if (config.workspace) {
      const workspaceId = await resolveWorkspaceId(client, config.workspace);
      const data = await client.get(
        workspaceApiPath(workspaceId, `/projects/slug-availability/${encodeURIComponent(slug)}`)
      );
      return { data };
    }

    const owner = requireFlag(options, {
      optionKey: "owner",
      label: "username",
      flag: "--owner",
      example: SLUG_EXAMPLE
    });
    const data = await client.get(
      `/api/projects/slug-availability/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}`
    );
    return { data };
  }
};
