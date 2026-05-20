import { listMcpTools, mcpToolDescriptions, mcpToolInputSchemas, type McpToolName } from "@agent-artifacts/mcp";
import { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface CliCommandSpec {
  /** Space-separated command path, e.g. "artifact create" */
  command: string;
  description: string;
  /** Matching MCP tool name when applicable */
  mcpTool?: McpToolName;
  http: { method: HttpMethod; path: string };
  inputSchema?: Record<string, unknown>;
  mutates: boolean;
  /** Example argv after global flags */
  example?: string;
}

const mcpHttpMapping: Record<McpToolName, { method: HttpMethod; path: string; command: string; example?: string }> = {
  get_current_principal: { method: "GET", path: "/api/profile/me", command: "principal get", example: "aa principal get" },
  check_project_slug_availability: {
    method: "GET",
    path: "/api/projects/slug-availability/{ownerUsername}/{slug}",
    command: "project slug-availability",
    example: "aa project slug-availability alice my-app"
  },
  create_project: { method: "POST", path: "/api/projects", command: "project create", example: 'aa project create --json \'{"ownerUsername":"alice","slug":"my-app","title":"My App"}\'' },
  list_projects: { method: "GET", path: "/api/profile/projects", command: "project list", example: "aa project list" },
  check_slug_availability: {
    method: "GET",
    path: "/api/artifacts/slug-availability/{ownerUsername}/{projectSlug}/{slug}",
    command: "artifact slug-availability",
    example: "aa artifact slug-availability alice default readme"
  },
  create_artifact: {
    method: "POST",
    path: "/api/artifacts",
    command: "artifact create",
    example:
      'aa artifact create --json \'{"ownerUsername":"alice","projectSlug":"default","slug":"readme","type":"markdown","title":"Readme","content":"# Hi"}\''
  },
  update_artifact: {
    method: "POST",
    path: "/api/artifacts/{artifactId}/versions",
    command: "artifact update",
    example: 'aa artifact update ARTIFACT_ID --json \'{"content":"# Updated"}\''
  },
  get_artifact: { method: "GET", path: "/api/artifacts/{artifactId}", command: "artifact get", example: "aa artifact get ARTIFACT_ID" },
  get_artifact_content: {
    method: "GET",
    path: "/api/artifacts/{artifactId}/content",
    command: "artifact content",
    example: "aa artifact content ARTIFACT_ID --version 1"
  },
  list_artifacts: { method: "GET", path: "/api/profile/artifacts", command: "artifact list", example: "aa artifact list" },
  list_artifact_versions: {
    method: "GET",
    path: "/api/artifacts/{artifactId}/versions",
    command: "artifact versions",
    example: "aa artifact versions ARTIFACT_ID --limit 20"
  },
  diff_artifact_versions: {
    method: "GET",
    path: "/api/artifacts/{artifactId}/diff",
    command: "artifact diff",
    example: "aa artifact diff ARTIFACT_ID --from 1 --to 2"
  },
  get_artifact_access: {
    method: "GET",
    path: "/api/artifacts/{artifactId}/access",
    command: "artifact access get",
    example: "aa artifact access get ARTIFACT_ID"
  },
  set_artifact_access: {
    method: "PATCH",
    path: "/api/artifacts/{artifactId}/access",
    command: "artifact access set",
    example: 'aa artifact access set ARTIFACT_ID --json \'{"publicView":true,"publicEdit":false,"viewerEmails":[]}\''
  },
  delete_artifact: { method: "DELETE", path: "/api/artifacts/{artifactId}", command: "artifact delete", example: "aa artifact delete ARTIFACT_ID" }
};

const apiOnlyCommands: CliCommandSpec[] = [
  {
    command: "health",
    description: "Check API health.",
    http: { method: "GET", path: "/health" },
    mutates: false,
    example: "aa health"
  },
  {
    command: "profile set-username",
    description: "Set the authenticated user's username (once).",
    http: { method: "POST", path: "/api/profile/username" },
    inputSchema: z.toJSONSchema(z.object({ username: z.string().min(1) })),
    mutates: true,
    example: 'aa profile set-username --json \'{"username":"alice"}\''
  },
  {
    command: "path project",
    description: "Resolve a project and list its artifacts by URL path.",
    http: { method: "GET", path: "/api/by-path/{username}/projects/{projectSlug}" },
    mutates: false,
    example: "aa path project alice default"
  },
  {
    command: "path artifact",
    description: "Get artifact metadata by owner/project/slug path.",
    http: { method: "GET", path: "/api/by-path/{username}/projects/{projectSlug}/{slug}" },
    mutates: false,
    example: "aa path artifact alice default readme"
  },
  {
    command: "share create",
    description: "Create a share link for an artifact.",
    http: { method: "POST", path: "/api/artifacts/{artifactId}/share-links" },
    inputSchema: z.toJSONSchema(
      z.object({
        role: z.enum(["viewer", "editor"]).default("viewer"),
        expiresAt: z.string().datetime().optional()
      })
    ),
    mutates: true,
    example: 'aa share create ARTIFACT_ID --json \'{"role":"viewer"}\''
  },
  {
    command: "share list",
    description: "List share links for an artifact.",
    http: { method: "GET", path: "/api/artifacts/{artifactId}/share-links" },
    mutates: false,
    example: "aa share list ARTIFACT_ID"
  },
  {
    command: "share revoke",
    description: "Revoke a share link by id.",
    http: { method: "POST", path: "/api/share-links/{shareLinkId}/revoke" },
    mutates: true,
    example: "aa share revoke SHARE_LINK_ID"
  },
  {
    command: "audit list",
    description: "List audit events for the authenticated owner.",
    http: { method: "GET", path: "/api/audit-events" },
    mutates: false,
    example: "aa audit list --artifact-id ARTIFACT_ID --limit 50"
  },
  {
    command: "artifact url-preview",
    description: "Preview the public URL for an artifact slug.",
    http: { method: "GET", path: "/api/slug-preview/{username}/{projectSlug}/{slug}" },
    mutates: false,
    example: "aa artifact url-preview alice default readme"
  }
];

export function listCliCommandSpecs(): CliCommandSpec[] {
  const mcpTools = listMcpTools();
  const mcpCommands: CliCommandSpec[] = mcpTools.map((tool) => {
    const mapping = mcpHttpMapping[tool.name as McpToolName];
    return {
      command: mapping.command,
      description: mcpToolDescriptions[tool.name as McpToolName],
      mcpTool: tool.name as McpToolName,
      http: { method: mapping.method, path: mapping.path },
      inputSchema: tool.inputSchema,
      mutates: mapping.method !== "GET",
      example: mapping.example
    };
  });

  return [...mcpCommands, ...apiOnlyCommands];
}

export function buildAgentSchema() {
  return {
    name: "agent-artifacts",
    version: "0.1.0",
    description: "CLI for agent-artifacts — mirrors MCP tools and REST API.",
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
      flag: "--format json|text"
    },
    invoke: {
      description: "Run any MCP tool by snake_case name with --json input.",
      example: 'aa invoke create_artifact --json \'{"ownerUsername":"alice",...}\''
    },
    commands: listCliCommandSpecs()
  };
}

export { mcpToolInputSchemas, type McpToolName };
