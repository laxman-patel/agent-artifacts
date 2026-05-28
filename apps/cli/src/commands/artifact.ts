import {
  createArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import { requireFlag } from "../args.js";
import {
  ARTIFACT_ID_FLAG,
  ARTIFACT_ID_OPTION,
  LIST_LIMIT_OPTIONS,
  OWNER_OPTION,
  PROJECT_SLUG_OPTION,
  SLUG_OPTION
} from "../command-options.js";
import type { CommandSpec } from "../command-spec.js";
import { CliError } from "../errors.js";
import { resolveListLimit, sliceListResult } from "../list-limit.js";
import { extractArtifactId, nextActionsForArtifact, nextActionsForArtifactList } from "../next-actions.js";
import { parseIntFlag } from "../parse-int-flag.js";
import { resolveWorkspaceId, workspaceApiPath } from "../workspace-context.js";

const SLUG_EXAMPLE = "artifacts artifact slug-availability --owner alice --project-slug default --slug readme";

function readArtifactId(options: Record<string, unknown>): string {
  return requireFlag(options, ARTIFACT_ID_FLAG);
}

export const artifactListCommand: CommandSpec = {
  name: "artifact list",
  description: "List owned artifacts",
  options: LIST_LIMIT_OPTIONS,
  http: { method: "GET", pathTemplate: "/api/profile/artifacts" },
  mutates: false,
  example: "artifacts artifact list --limit 50",
  async run({ client, options, config }) {
    const limitResult = resolveListLimit(options);
    if (config.workspace) {
      const workspaceId = await resolveWorkspaceId(client, config.workspace);
      const data = await client.get<{ artifacts: unknown[] }>(workspaceApiPath(workspaceId, "/artifacts"));
      const artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
      const { items } = sliceListResult(artifacts, limitResult, config, "artifacts");
      return { data: { ...data, artifacts: items }, nextActions: nextActionsForArtifactList(items) };
    }

    const data = await client.get<{ artifacts: unknown[] }>("/api/profile/artifacts");
    const artifacts = Array.isArray(data.artifacts) ? data.artifacts : [];
    const { items } = sliceListResult(artifacts, limitResult, config, "artifacts");
    return { data: { ...data, artifacts: items }, nextActions: nextActionsForArtifactList(items) };
  }
};

export const artifactGetCommand: CommandSpec = {
  name: "artifact get",
  description: "Get artifact metadata",
  options: [ARTIFACT_ID_OPTION],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}" },
  mutates: false,
  example: "artifacts artifact get --artifact-id ARTIFACT_ID",
  async run({ client, options }) {
    const id = readArtifactId(options);
    const data = await client.get(`/api/artifacts/${encodeURIComponent(id)}`);
    return { data, nextActions: nextActionsForArtifact(id) };
  }
};

export const artifactCreateCommand: CommandSpec = {
  name: "artifact create",
  description: "Create artifact with first version",
  options: [
    { flag: "--json <payload>", description: "JSON body", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" },
    { flag: "--ensure", description: "On slug conflict, return the existing artifact with created: false" }
  ],
  bodySchema: createArtifactInputSchema,
  http: { method: "POST", pathTemplate: "/api/artifacts" },
  mutates: true,
  example:
    'artifacts artifact create --json \'{"ownerUsername":"alice","projectSlug":"default","slug":"readme","type":"md","title":"Readme","content":"# Hi"}\'',
  async run({ client, body, options, config }) {
    const parsed = createArtifactInputSchema.parse(body);
    const payload =
      config.workspace !== undefined
        ? { ...parsed, ownerUsername: parsed.ownerUsername || config.workspace }
        : parsed;
    try {
      const data = await client.post<Record<string, unknown>>("/api/artifacts", payload);
      return { data: { ...data, created: true }, nextActions: nextActionsForArtifact(extractArtifactId(data)) };
    } catch (error) {
      if (options.ensure === true && error instanceof CliError && error.kind === "conflict") {
        const ownerUsername = payload.ownerUsername;
        const existing = await client.get<Record<string, unknown>>(
          `/api/by-path/${encodeURIComponent(ownerUsername)}/${encodeURIComponent(parsed.projectSlug)}/${encodeURIComponent(parsed.slug)}`
        );
        return {
          data: { ...existing, created: false },
          nextActions: nextActionsForArtifact(extractArtifactId(existing))
        };
      }
      throw error;
    }
  }
};

export const artifactUpdateCommand: CommandSpec = {
  name: "artifact update",
  description: "Append a new artifact version",
  options: [
    ARTIFACT_ID_OPTION,
    { flag: "--json <payload>", description: "JSON body (content, optional changelog)", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: updateArtifactInputSchema,
  http: { method: "POST", pathTemplate: "/api/artifacts/{artifactId}/versions" },
  mutates: true,
  example: 'artifacts artifact update --artifact-id ARTIFACT_ID --json \'{"content":"# Updated"}\'',
  async run({ client, options, body }) {
    const id = readArtifactId(options);
    const data = await client.post(
      `/api/artifacts/${encodeURIComponent(id)}/versions`,
      updateArtifactInputSchema.parse(body)
    );
    return { data, nextActions: nextActionsForArtifact(id) };
  }
};

export const artifactDeleteCommand: CommandSpec = {
  name: "artifact delete",
  description: "Soft-delete an artifact",
  options: [ARTIFACT_ID_OPTION, { flag: "--yes", description: "Confirm delete (soft-delete; no prompt required)" }],
  http: { method: "DELETE", pathTemplate: "/api/artifacts/{artifactId}" },
  mutates: true,
  example: "artifacts artifact delete --artifact-id ARTIFACT_ID",
  async run({ client, options }) {
    const id = readArtifactId(options);
    try {
      const data = await client.delete(`/api/artifacts/${encodeURIComponent(id)}`);
      return { data };
    } catch (error) {
      if (error instanceof CliError && error.kind === "not_found") {
        return { data: { artifactId: id, alreadyDeleted: true } };
      }
      throw error;
    }
  }
};

export const artifactContentCommand: CommandSpec = {
  name: "artifact content",
  description: "Get artifact source content",
  options: [
    ARTIFACT_ID_OPTION,
    { flag: "--version <n>", description: "Version number", parse: parseIntFlag("--version", "artifacts artifact content --artifact-id ARTIFACT_ID --version 1") }
  ],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/content" },
  mutates: false,
  example: "artifacts artifact content --artifact-id ARTIFACT_ID --version 1",
  async run({ client, options, config }) {
    const id = readArtifactId(options);
    const version = options.version as number | undefined;
    const content = await client.request<string>("GET", `/api/artifacts/${encodeURIComponent(id)}/content`, {
      query: version !== undefined ? { version } : undefined,
      rawText: true
    });
    if (config.format === "json") {
      return { data: { artifactId: id, version: version ?? "latest", content } };
    }
    return { data: content, emitRawText: true };
  }
};

export const artifactVersionsCommand: CommandSpec = {
  name: "artifact versions",
  description: "List artifact versions",
  options: [ARTIFACT_ID_OPTION, ...LIST_LIMIT_OPTIONS],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/versions" },
  mutates: false,
  example: "artifacts artifact versions --artifact-id ARTIFACT_ID --limit 20",
  async run({ client, options }) {
    const id = readArtifactId(options);
    const limitResult = resolveListLimit(options);
    const data = await client.get(`/api/artifacts/${encodeURIComponent(id)}/versions`, {
      limit: limitResult.apiLimit
    });
    return { data };
  }
};

export const artifactDiffCommand: CommandSpec = {
  name: "artifact diff",
  description: "Diff two artifact versions",
  options: [
    ARTIFACT_ID_OPTION,
    { flag: "--from <n>", description: "From version", required: true, parse: parseIntFlag("--from", "artifacts artifact diff --artifact-id ARTIFACT_ID --from 1 --to 2") },
    { flag: "--to <n>", description: "To version", required: true, parse: parseIntFlag("--to", "artifacts artifact diff --artifact-id ARTIFACT_ID --from 1 --to 2") }
  ],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/diff" },
  mutates: false,
  example: "artifacts artifact diff --artifact-id ARTIFACT_ID --from 1 --to 2",
  async run({ client, options }) {
    const id = readArtifactId(options);
    const data = await client.get(`/api/artifacts/${encodeURIComponent(id)}/diff`, {
      from: options.from as number,
      to: options.to as number
    });
    return { data };
  }
};

export const artifactSlugAvailabilityCommand: CommandSpec = {
  name: "artifact slug-availability",
  description: "Check artifact slug availability in a project",
  options: [OWNER_OPTION, PROJECT_SLUG_OPTION, SLUG_OPTION],
  http: {
    method: "GET",
    pathTemplate: "/api/artifacts/slug-availability/{ownerUsername}/{projectSlug}/{slug}"
  },
  mutates: false,
  example: SLUG_EXAMPLE,
  async run({ client, options }) {
    const owner = requireFlag(options, {
      optionKey: "owner",
      label: "username",
      flag: "--owner",
      example: SLUG_EXAMPLE
    });
    const projectSlug = requireFlag(options, {
      optionKey: "projectSlug",
      label: "slug",
      flag: "--project-slug",
      example: SLUG_EXAMPLE
    });
    const slug = requireFlag(options, {
      optionKey: "slug",
      label: "slug",
      flag: "--slug",
      example: SLUG_EXAMPLE
    });
    const data = await client.get(
      `/api/artifacts/slug-availability/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data };
  }
};

export const artifactUrlPreviewCommand: CommandSpec = {
  name: "artifact url-preview",
  description: "Preview public artifact URL",
  options: [OWNER_OPTION, PROJECT_SLUG_OPTION, SLUG_OPTION],
  http: { method: "GET", pathTemplate: "/api/slug-preview/{username}/{projectSlug}/{slug}" },
  mutates: false,
  example: "artifacts artifact url-preview --owner alice --project-slug default --slug readme",
  async run({ client, options }) {
    const owner = requireFlag(options, {
      optionKey: "owner",
      label: "username",
      flag: "--owner",
      example: SLUG_EXAMPLE
    });
    const projectSlug = requireFlag(options, {
      optionKey: "projectSlug",
      label: "slug",
      flag: "--project-slug",
      example: SLUG_EXAMPLE
    });
    const slug = requireFlag(options, {
      optionKey: "slug",
      label: "slug",
      flag: "--slug",
      example: SLUG_EXAMPLE
    });
    const data = await client.get<{ url: string }>(
      `/api/slug-preview/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data, nextActions: [{ command: `artifacts path artifact --owner ${owner} --project-slug ${projectSlug} --slug ${slug}`, description: "Resolve artifact by path" }] };
  }
};

export const artifactAccessGetCommand: CommandSpec = {
  name: "artifact access get",
  description: "Get access settings",
  options: [ARTIFACT_ID_OPTION],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/access" },
  mutates: false,
  example: "artifacts artifact access get --artifact-id ARTIFACT_ID",
  async run({ client, options }) {
    const id = readArtifactId(options);
    const data = await client.get(`/api/artifacts/${encodeURIComponent(id)}/access`);
    return { data };
  }
};

export const artifactAccessSetCommand: CommandSpec = {
  name: "artifact access set",
  description: "Update access settings",
  options: [
    ARTIFACT_ID_OPTION,
    { flag: "--json <payload>", description: "JSON access body", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: setArtifactAccessInputSchema,
  http: { method: "PATCH", pathTemplate: "/api/artifacts/{artifactId}/access" },
  mutates: true,
  example:
    'artifacts artifact access set --artifact-id ARTIFACT_ID --json \'{"publicView":true,"publicEdit":false,"viewerEmails":[]}\'',
  async run({ client, options, body }) {
    const id = readArtifactId(options);
    const data = await client.patch(
      `/api/artifacts/${encodeURIComponent(id)}/access`,
      setArtifactAccessInputSchema.parse(body)
    );
    return { data, nextActions: [{ command: `artifacts artifact access get --artifact-id ${id}`, description: "Verify access settings" }] };
  }
};
