import { mcpToolInputSchemas, type McpToolName } from "@agent-artifacts/mcp";
import type { ApiClient } from "./client.js";
import { CliError } from "./errors.js";

export async function invokeMcpTool(client: ApiClient, toolName: McpToolName, input: unknown): Promise<unknown> {
  const parsed = mcpToolInputSchemas[toolName].parse(input);

  switch (toolName) {
    case "get_current_principal": {
      const me = await client.get<{ user: { id: string; email: string }; profile: { username: string } | null }>(
        "/api/profile/me"
      );
      return {
        type: "user",
        id: me.user.id,
        ownerUserId: me.user.id,
        email: me.user.email,
        scopes: [],
        username: me.profile?.username ?? null
      };
    }
    case "check_project_slug_availability": {
      const r = parsed as { ownerUsername: string; slug: string };
      return client.get(`/api/projects/slug-availability/${encodeURIComponent(r.ownerUsername)}/${encodeURIComponent(r.slug)}`);
    }
    case "create_project":
      return client.post("/api/projects", parsed);
    case "list_projects": {
      const result = await client.get<{ projects: unknown[] }>("/api/profile/projects");
      return result.projects;
    }
    case "check_slug_availability": {
      const r = parsed as { ownerUsername: string; projectSlug: string; slug: string };
      return client.get(
        `/api/artifacts/slug-availability/${encodeURIComponent(r.ownerUsername)}/${encodeURIComponent(r.projectSlug)}/${encodeURIComponent(r.slug)}`
      );
    }
    case "create_artifact":
      return client.post("/api/artifacts", parsed);
    case "update_artifact": {
      const r = parsed as { artifactId: string; content: string; changelog?: string; expectedLatestVersion?: number };
      const { artifactId, ...body } = r;
      return client.post(`/api/artifacts/${encodeURIComponent(artifactId)}/versions`, body);
    }
    case "get_artifact": {
      const r = parsed as { artifactId: string };
      return client.get(`/api/artifacts/${encodeURIComponent(r.artifactId)}`);
    }
    case "get_artifact_content": {
      const r = parsed as { artifactId: string; versionNumber?: number };
      const content = await client.request<string>("GET", `/api/artifacts/${encodeURIComponent(r.artifactId)}/content`, {
        query: r.versionNumber !== undefined ? { version: r.versionNumber } : undefined,
        rawText: true
      });
      return { content };
    }
    case "list_artifacts": {
      const result = await client.get<{ artifacts: unknown[] }>("/api/profile/artifacts");
      return result.artifacts;
    }
    case "list_artifact_versions": {
      const r = parsed as { artifactId: string; limit?: number };
      const result = await client.get<{ versions: unknown[] }>(`/api/artifacts/${encodeURIComponent(r.artifactId)}/versions`, {
        limit: r.limit
      });
      return result.versions;
    }
    case "diff_artifact_versions": {
      const r = parsed as { artifactId: string; fromVersion: number; toVersion: number };
      return client.get(`/api/artifacts/${encodeURIComponent(r.artifactId)}/diff`, {
        from: r.fromVersion,
        to: r.toVersion
      });
    }
    case "get_artifact_access": {
      const r = parsed as { artifactId: string };
      return client.get(`/api/artifacts/${encodeURIComponent(r.artifactId)}/access`);
    }
    case "set_artifact_access": {
      const r = parsed as { artifactId: string; access: unknown };
      return client.patch(`/api/artifacts/${encodeURIComponent(r.artifactId)}/access`, r.access);
    }
    case "delete_artifact": {
      const r = parsed as { artifactId: string };
      return client.delete(`/api/artifacts/${encodeURIComponent(r.artifactId)}`);
    }
    default:
      return assertNever(toolName);
  }
}

export function isMcpToolName(name: string): name is McpToolName {
  return name in mcpToolInputSchemas;
}

function assertNever(value: never): never {
  throw new CliError("unknown", `Unhandled MCP tool: ${String(value)}`, 1);
}
