import {
  createArtifactInputSchema,
  createProjectInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface CliCommandSpec {
  /** Space-separated command path, e.g. "artifact create" */
  command: string;
  description: string;
  http: { method: HttpMethod; path: string };
  bodySchema?: Record<string, unknown>;
  mutates: boolean;
  /** Example argv after global flags */
  example?: string;
}

const shareLinkBodySchema = z.object({
  role: z.enum(["viewer", "editor"]).default("viewer"),
  expiresAt: z.iso.datetime().optional()
});

const usernameBodySchema = z.object({ username: z.string().min(1) });

export const cliCommandSpecs: CliCommandSpec[] = [
  {
    command: "login",
    description: "Sign in via browser and store credentials locally.",
    http: { method: "GET", path: "/cli/login" },
    mutates: true,
    example: "artifacts login"
  },
  {
    command: "logout",
    description: "Remove locally stored credentials.",
    http: { method: "DELETE", path: "~/.config/agent-artifacts/credentials.json" },
    mutates: true,
    example: "artifacts logout"
  },
  {
    command: "whoami",
    description: "Show the authenticated user and profile.",
    http: { method: "GET", path: "/api/profile/me" },
    mutates: false,
    example: "artifacts whoami"
  },
  {
    command: "health",
    description: "Check API health.",
    http: { method: "GET", path: "/health" },
    mutates: false,
    example: "artifacts health"
  },
  {
    command: "profile get",
    description: "Get the authenticated user and profile.",
    http: { method: "GET", path: "/api/profile/me" },
    mutates: false,
    example: "artifacts profile get"
  },
  {
    command: "profile set-username",
    description: "Set the authenticated user's username (once).",
    http: { method: "POST", path: "/api/profile/username" },
    bodySchema: z.toJSONSchema(usernameBodySchema),
    mutates: true,
    example: 'artifacts profile set-username --json \'{"username":"alice"}\''
  },
  {
    command: "project list",
    description: "List projects owned by the authenticated user.",
    http: { method: "GET", path: "/api/profile/projects" },
    mutates: false,
    example: "artifacts project list"
  },
  {
    command: "project create",
    description: "Create a new project.",
    http: { method: "POST", path: "/api/projects" },
    bodySchema: z.toJSONSchema(createProjectInputSchema),
    mutates: true,
    example: 'artifacts project create --json \'{"ownerUsername":"alice","slug":"my-app","title":"My App"}\''
  },
  {
    command: "project slug-availability",
    description: "Check whether a project slug is available.",
    http: { method: "GET", path: "/api/projects/slug-availability/{ownerUsername}/{slug}" },
    mutates: false,
    example: "artifacts project slug-availability alice my-app"
  },
  {
    command: "artifact list",
    description: "List artifacts owned by the authenticated user.",
    http: { method: "GET", path: "/api/profile/artifacts" },
    mutates: false,
    example: "artifacts artifact list"
  },
  {
    command: "artifact create",
    description: "Create a new artifact and immutable first version.",
    http: { method: "POST", path: "/api/artifacts" },
    bodySchema: z.toJSONSchema(createArtifactInputSchema),
    mutates: true,
    example:
      'artifacts artifact create --json \'{"ownerUsername":"alice","projectSlug":"default","slug":"readme","type":"markdown","title":"Readme","content":"# Hi"}\''
  },
  {
    command: "artifact get",
    description: "Read artifact metadata.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}" },
    mutates: false,
    example: "artifacts artifact get ARTIFACT_ID"
  },
  {
    command: "artifact update",
    description: "Append a new immutable version to an artifact.",
    http: { method: "POST", path: "/api/artifacts/{artifactId}/versions" },
    bodySchema: z.toJSONSchema(updateArtifactInputSchema),
    mutates: true,
    example: 'artifacts artifact update ARTIFACT_ID --json \'{"content":"# Updated"}\''
  },
  {
    command: "artifact delete",
    description: "Soft-delete an artifact.",
    http: { method: "DELETE", path: "/api/artifacts/{artifactId}" },
    mutates: true,
    example: "artifacts artifact delete ARTIFACT_ID"
  },
  {
    command: "artifact content",
    description: "Read source content for an artifact version.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}/content" },
    mutates: false,
    example: "artifacts artifact content ARTIFACT_ID --version 1"
  },
  {
    command: "artifact versions",
    description: "List immutable versions for an artifact.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}/versions" },
    mutates: false,
    example: "artifacts artifact versions ARTIFACT_ID --limit 20"
  },
  {
    command: "artifact diff",
    description: "Return a unified diff between two artifact versions.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}/diff" },
    mutates: false,
    example: "artifacts artifact diff ARTIFACT_ID --from 1 --to 2"
  },
  {
    command: "artifact slug-availability",
    description: "Check whether an artifact slug is available within a project.",
    http: { method: "GET", path: "/api/artifacts/slug-availability/{ownerUsername}/{projectSlug}/{slug}" },
    mutates: false,
    example: "artifacts artifact slug-availability alice default readme"
  },
  {
    command: "artifact url-preview",
    description: "Preview the public URL for an artifact slug.",
    http: { method: "GET", path: "/api/slug-preview/{username}/{projectSlug}/{slug}" },
    mutates: false,
    example: "artifacts artifact url-preview alice default readme"
  },
  {
    command: "artifact access get",
    description: "Read artifact access settings.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}/access" },
    mutates: false,
    example: "artifacts artifact access get ARTIFACT_ID"
  },
  {
    command: "artifact access set",
    description: "Update artifact access settings.",
    http: { method: "PATCH", path: "/api/artifacts/{artifactId}/access" },
    bodySchema: z.toJSONSchema(setArtifactAccessInputSchema),
    mutates: true,
    example: 'artifacts artifact access set ARTIFACT_ID --json \'{"publicView":true,"publicEdit":false,"viewerEmails":[]}\''
  },
  {
    command: "path project",
    description: "Resolve a project and list its artifacts by URL path.",
    http: { method: "GET", path: "/api/by-path/{username}/projects/{projectSlug}" },
    mutates: false,
    example: "artifacts path project alice default"
  },
  {
    command: "path artifact",
    description: "Get artifact metadata by owner/project/slug path.",
    http: { method: "GET", path: "/api/by-path/{username}/projects/{projectSlug}/{slug}" },
    mutates: false,
    example: "artifacts path artifact alice default readme"
  },
  {
    command: "share create",
    description: "Create a share link for an artifact.",
    http: { method: "POST", path: "/api/artifacts/{artifactId}/share-links" },
    bodySchema: z.toJSONSchema(shareLinkBodySchema),
    mutates: true,
    example: 'artifacts share create ARTIFACT_ID --json \'{"role":"viewer"}\''
  },
  {
    command: "share list",
    description: "List share links for an artifact.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}/share-links" },
    mutates: false,
    example: "artifacts share list ARTIFACT_ID"
  },
  {
    command: "share revoke",
    description: "Revoke a share link by id.",
    http: { method: "POST", path: "/api/share-links/{shareLinkId}/revoke" },
    mutates: true,
    example: "artifacts share revoke SHARE_LINK_ID"
  },
  {
    command: "audit list",
    description: "List audit events for the authenticated owner.",
    http: { method: "GET", path: "/api/audit-events" },
    mutates: false,
    example: "artifacts audit list --artifact-id ARTIFACT_ID --limit 50"
  }
];

export function listCliCommandSpecs(): CliCommandSpec[] {
  return cliCommandSpecs;
}

export function buildAgentSchema() {
  return {
    name: "artifacts",
    version: "0.1.0",
    description: "CLI for agent-artifacts — thin wrapper over the REST API.",
    auth: {
      env: ["AGENT_ARTIFACTS_TOKEN"],
      flag: "--token",
      header: "Authorization: Bearer <token>"
    },
    baseUrl: {
      env: ["AGENT_ARTIFACTS_BASE_URL"],
      flag: "--base-url",
      default: "http://127.0.0.1:3001"
    },
    output: {
      default: "json when stdout is not a TTY, text when interactive",
      flag: "--format json|text",
      envelope: {
        success: { ok: true, data: "...", next_actions: "optional follow-up commands" },
        failure: { ok: false, error: { kind: "...", message: "..." } }
      },
      exitCodes: {
        "0": "success",
        "2": "invalid_request",
        "3": "not_found",
        "4": "forbidden or auth",
        "5": "conflict"
      }
    },
    discovery: "Run `artifacts schema` — do not parse --help.",
    commands: listCliCommandSpecs()
  };
}
