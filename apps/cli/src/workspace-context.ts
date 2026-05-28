import type { ApiClient } from "./client.js";
import { CliError } from "./errors.js";

interface WorkspaceSummary {
  id: string;
  slug: string;
}

export async function resolveWorkspaceId(client: ApiClient, slug: string): Promise<string> {
  const normalized = slug.trim().toLowerCase();
  const data = await client.get<{ workspaces: WorkspaceSummary[] }>("/api/workspaces");
  const workspaces = Array.isArray(data.workspaces) ? data.workspaces : [];
  const match = workspaces.find((workspace) => workspace.slug.toLowerCase() === normalized);
  if (!match) {
    throw new CliError("not_found", `Workspace "${slug}" was not found.`, 3);
  }
  return match.id;
}

export function workspaceApiPath(workspaceId: string, suffix: string): string {
  return `/api/workspaces/${encodeURIComponent(workspaceId)}${suffix}`;
}
