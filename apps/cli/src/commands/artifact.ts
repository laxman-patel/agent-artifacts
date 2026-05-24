import {
  createArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import { requirePositional } from "../args.js";
import type { CommandSpec } from "../command-spec.js";
import { extractArtifactId, nextActionsForArtifact } from "../next-actions.js";

export const artifactListCommand: CommandSpec = {
  name: "artifact list",
  description: "List owned artifacts",
  http: { method: "GET", pathTemplate: "/api/profile/artifacts" },
  mutates: false,
  example: "artifacts artifact list",
  async run({ client }) {
    const data = await client.get("/api/profile/artifacts");
    return { data };
  }
};

export const artifactGetCommand: CommandSpec = {
  name: "artifact get",
  description: "Get artifact metadata",
  positional: [{ name: "artifactId", required: true }],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}" },
  mutates: false,
  example: "artifacts artifact get ARTIFACT_ID",
  async run({ client, positionals }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.get(`/api/artifacts/${encodeURIComponent(artifactId)}`);
    return { data, nextActions: nextActionsForArtifact(artifactId) };
  }
};

export const artifactCreateCommand: CommandSpec = {
  name: "artifact create",
  description: "Create artifact with first version",
  options: [
    { flag: "--json <payload>", description: "JSON body", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: createArtifactInputSchema,
  http: { method: "POST", pathTemplate: "/api/artifacts" },
  mutates: true,
  example:
    'artifacts artifact create --json \'{"ownerUsername":"alice","projectSlug":"default","slug":"readme","type":"markdown","title":"Readme","content":"# Hi"}\'',
  async run({ client, body }) {
    const data = await client.post("/api/artifacts", createArtifactInputSchema.parse(body));
    return { data, nextActions: nextActionsForArtifact(extractArtifactId(data)) };
  }
};

export const artifactUpdateCommand: CommandSpec = {
  name: "artifact update",
  description: "Append a new artifact version",
  positional: [{ name: "artifactId", required: true }],
  options: [
    { flag: "--json <payload>", description: "JSON body (content, optional changelog)", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: updateArtifactInputSchema,
  http: { method: "POST", pathTemplate: "/api/artifacts/{artifactId}/versions" },
  mutates: true,
  example: 'artifacts artifact update ARTIFACT_ID --json \'{"content":"# Updated"}\'',
  async run({ client, positionals, body }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.post(
      `/api/artifacts/${encodeURIComponent(artifactId)}/versions`,
      updateArtifactInputSchema.parse(body)
    );
    return { data, nextActions: nextActionsForArtifact(artifactId) };
  }
};

export const artifactDeleteCommand: CommandSpec = {
  name: "artifact delete",
  description: "Soft-delete an artifact",
  positional: [{ name: "artifactId", required: true }],
  http: { method: "DELETE", pathTemplate: "/api/artifacts/{artifactId}" },
  mutates: true,
  example: "artifacts artifact delete ARTIFACT_ID",
  async run({ client, positionals }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.delete(`/api/artifacts/${encodeURIComponent(artifactId)}`);
    return { data };
  }
};

export const artifactContentCommand: CommandSpec = {
  name: "artifact content",
  description: "Get artifact source content",
  positional: [{ name: "artifactId", required: true }],
  options: [{ flag: "--version <n>", description: "Version number", parse: (v) => Number.parseInt(v, 10) }],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/content" },
  mutates: false,
  example: "artifacts artifact content ARTIFACT_ID --version 1",
  async run({ client, positionals, options, config }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const version = options.version as number | undefined;
    const content = await client.request<string>("GET", `/api/artifacts/${encodeURIComponent(artifactId)}/content`, {
      query: version !== undefined ? { version } : undefined,
      rawText: true
    });
    if (config.format === "json") {
      return { data: { artifactId, version: version ?? "latest", content } };
    }
    return { data: content, emitRawText: true };
  }
};

export const artifactVersionsCommand: CommandSpec = {
  name: "artifact versions",
  description: "List artifact versions",
  positional: [{ name: "artifactId", required: true }],
  options: [{ flag: "--limit <n>", description: "Max versions", parse: (v) => Number.parseInt(v, 10) }],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/versions" },
  mutates: false,
  example: "artifacts artifact versions ARTIFACT_ID --limit 20",
  async run({ client, positionals, options }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/versions`, {
      limit: options.limit as number | undefined
    });
    return { data };
  }
};

export const artifactDiffCommand: CommandSpec = {
  name: "artifact diff",
  description: "Diff two artifact versions",
  positional: [{ name: "artifactId", required: true }],
  options: [
    { flag: "--from <n>", description: "From version", required: true, parse: (v) => Number.parseInt(v, 10) },
    { flag: "--to <n>", description: "To version", required: true, parse: (v) => Number.parseInt(v, 10) }
  ],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/diff" },
  mutates: false,
  example: "artifacts artifact diff ARTIFACT_ID --from 1 --to 2",
  async run({ client, positionals, options }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/diff`, {
      from: options.from as number,
      to: options.to as number
    });
    return { data };
  }
};

export const artifactSlugAvailabilityCommand: CommandSpec = {
  name: "artifact slug-availability",
  description: "Check artifact slug availability in a project",
  positional: [
    { name: "owner", required: true },
    { name: "project", required: true },
    { name: "slug", required: true }
  ],
  http: {
    method: "GET",
    pathTemplate: "/api/artifacts/slug-availability/{ownerUsername}/{projectSlug}/{slug}"
  },
  mutates: false,
  example: "artifacts artifact slug-availability alice default readme",
  async run({ client, positionals }) {
    const owner = requirePositional(positionals, 0, "owner", "artifacts artifact slug-availability alice default readme");
    const projectSlug = requirePositional(positionals, 1, "project", "artifacts artifact slug-availability alice default readme");
    const slug = requirePositional(positionals, 2, "slug", "artifacts artifact slug-availability alice default readme");
    const data = await client.get(
      `/api/artifacts/slug-availability/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data };
  }
};

export const artifactUrlPreviewCommand: CommandSpec = {
  name: "artifact url-preview",
  description: "Preview public artifact URL",
  positional: [
    { name: "owner", required: true },
    { name: "project", required: true },
    { name: "slug", required: true }
  ],
  http: { method: "GET", pathTemplate: "/api/slug-preview/{username}/{projectSlug}/{slug}" },
  mutates: false,
  example: "artifacts artifact url-preview alice default readme",
  async run({ client, positionals }) {
    const owner = requirePositional(positionals, 0, "owner", "artifacts artifact slug-availability alice default readme");
    const projectSlug = requirePositional(positionals, 1, "project", "artifacts artifact slug-availability alice default readme");
    const slug = requirePositional(positionals, 2, "slug", "artifacts artifact slug-availability alice default readme");
    const data = await client.get<{ url: string }>(
      `/api/slug-preview/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
    );
    return { data };
  }
};

export const artifactAccessGetCommand: CommandSpec = {
  name: "artifact access get",
  description: "Get access settings",
  positional: [{ name: "artifactId", required: true }],
  http: { method: "GET", pathTemplate: "/api/artifacts/{artifactId}/access" },
  mutates: false,
  example: "artifacts artifact access get ARTIFACT_ID",
  async run({ client, positionals }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/access`);
    return { data };
  }
};

export const artifactAccessSetCommand: CommandSpec = {
  name: "artifact access set",
  description: "Update access settings",
  positional: [{ name: "artifactId", required: true }],
  options: [
    { flag: "--json <payload>", description: "JSON access body", required: true },
    { flag: "--json-file <path>", description: "Read JSON from file (use - for stdin)" }
  ],
  bodySchema: setArtifactAccessInputSchema,
  http: { method: "PATCH", pathTemplate: "/api/artifacts/{artifactId}/access" },
  mutates: true,
  example:
    'artifacts artifact access set ARTIFACT_ID --json \'{"publicView":true,"publicEdit":false,"viewerEmails":[]}\'',
  async run({ client, positionals, body }) {
    const artifactId = requirePositional(positionals, 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    const data = await client.patch(
      `/api/artifacts/${encodeURIComponent(artifactId)}/access`,
      setArtifactAccessInputSchema.parse(body)
    );
    return { data };
  }
};
