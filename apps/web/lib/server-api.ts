import { Logger } from "@logtail/next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";

export type ApiResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; status: number; message: string };

interface ApiCallOptions {
  cookie?: string;
  query?: Record<string, string | number | undefined>;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accept?: "json" | "text";
  parseOk?: (response: Response) => Promise<unknown>;
}

type ArtifactRoute = { ownerUsername: string; projectSlug: string; slug: string };
type OwnerRoute = { ownerUsername: string; slug: string };
type ArtifactVersion = { id: string; versionNumber: number; changelog: string | null; createdAt: string };
type ShareLinkSummary = { id: string; role: string; createdAt: string; expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null };
type AuditEvent = { id: string; artifactId: string | null; actorPrincipalType: string; actorPrincipalId: string; action: string; targetType: string; targetId: string; metadata: Record<string, unknown>; createdAt: string };

export interface ProfileMeResponse {
  user: { id: string; email: string; name: string; image: string | null; emailVerified: boolean };
  profile: { username: string; displayName: string | null; createdAt: string; updatedAt: string } | null;
}

export interface ProjectSummary {
  id: string; ownerUsername: string; slug: string; title: string; description: string | null; updatedAt: string;
}

export interface ArtifactOwnerSummary {
  id: string; ownerUsername: string; projectId: string; projectSlug: string; slug: string; title: string; type: string; updatedAt: string;
}

export interface ArtifactMeta {
  id: string; ownerUserId: string; ownerUsername: string; projectId: string; projectSlug: string; slug: string;
  title: string; description: string | null; type: "html" | "md" | "jsx"; publicView: boolean; publicEdit: boolean;
  latestVersionId: string | null; updatedAt: string;
}

export type WorkspaceKind = "personal" | "team";
export type WorkspaceRole = "owner" | "admin" | "member" | "viewer" | "billing_admin";
export type InvitableWorkspaceRole = "admin" | "member" | "viewer" | "billing_admin";

export interface WorkspaceSummary {
  id: string;
  slug: string;
  name: string;
  kind: WorkspaceKind;
  personalUserId: string | null;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberSummary {
  id: string;
  workspaceId: string;
  userId: string;
  email?: string | null;
  name?: string | null;
  displayName?: string | null;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceInvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: string;
  expiresAt: string;
  createdAt: string;
}

export interface WorkspaceProjectSummary {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  workspaceId: string | null;
  slug: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceArtifactSummary {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  projectId: string;
  projectSlug: string;
  workspaceId: string | null;
  slug: string;
  title: string;
  description: string | null;
  type: "html" | "md" | "jsx";
  updatedAt: string;
}

export function internalApiOrigin(): string {
  return (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
}

export function cookieHeader(cookieStore: { getAll(): { name: string; value: string }[] }): string {
  return cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function apiCall<T>(path: string, opts: ApiCallOptions = {}): Promise<ApiResult<T>> {
  const incoming = await headers();
  const requestId = incoming.get("x-request-id") ?? randomUUID();
  const url = new URL(`${internalApiOrigin()}${path}`);
  if (opts.query) for (const [key, value] of Object.entries(opts.query)) if (value !== undefined) url.searchParams.set(key, String(value));
  const headersOut: Record<string, string> = { "x-request-id": requestId };
  if (opts.cookie) headersOut.cookie = opts.cookie;
  if (opts.body !== undefined) headersOut["content-type"] = "application/json";

  try {
    const response = await fetch(url, {
      method: opts.method ?? "GET",
      headers: headersOut,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    });

    if (!response.ok) {
      const log = new Logger();
      const errBody = await response.json().catch(() => ({}));
      const message = (errBody as { message?: string }).message ?? response.statusText;
      log.warn("internal_api_error", {
        path,
        requestId,
        status: response.status,
        message
      });
      await log.flush();
      return { ok: false, status: response.status, message };
    }

    const body = opts.parseOk ? await opts.parseOk(response) : opts.accept === "text" ? await response.text() : await response.json();
    return { ok: true, status: response.status, body: body as T };
  } catch (error) {
    const log = new Logger();
    log.error("internal_api_fetch_failed", {
      path,
      requestId,
      message: error instanceof Error ? error.message : String(error)
    });
    await log.flush();
    throw error;
  }
}

export function artifactPath(artifact: ArtifactRoute): string {
  return `/${artifact.ownerUsername}/${artifact.projectSlug}/${artifact.slug}`;
}

export function projectPath(project: OwnerRoute): string {
  return `/${project.ownerUsername}/${project.slug}`;
}

export function workspacePath(workspace: { slug: string }): string {
  return `/w/${workspace.slug}`;
}

export function workspaceProjectPath(workspace: { slug: string }, project: { slug: string }): string {
  return `${workspacePath(workspace)}/${project.slug}`;
}

export function workspaceArtifactPath(
  workspace: { slug: string },
  artifact: { projectSlug: string; slug: string }
): string {
  return `${workspacePath(workspace)}/${artifact.projectSlug}/${artifact.slug}`;
}

export function workspaceSettingsPath(workspace: { slug: string }): string {
  return `/w/${workspace.slug}/settings`;
}

const workspaceApi = (workspaceId: string, suffix = "") =>
  `/api/workspaces/${encodeURIComponent(workspaceId)}${suffix}`;

const byPath = (username: string, projectSlug: string, slug?: string) =>
  `/api/by-path/${encodeURIComponent(username)}/${encodeURIComponent(projectSlug)}${slug ? `/${encodeURIComponent(slug)}` : ""}`;

const artifactApi = (artifactId: string, suffix: string) =>
  `/api/artifacts/${encodeURIComponent(artifactId)}/${suffix}`;

export const fetchProfileMe = (cookie: string) => apiCall<ProfileMeResponse>("/api/profile/me", { cookie });
export const fetchOwnedProjects = (cookie: string) => apiCall<{ projects: ProjectSummary[] }>("/api/profile/projects", { cookie });
export const fetchOwnedArtifacts = (cookie: string) => apiCall<{ artifacts: ArtifactOwnerSummary[] }>("/api/profile/artifacts", { cookie });
export const fetchProjectByPath = (username: string, projectSlug: string, cookie?: string) =>
  apiCall<{ project: ProjectSummary; artifacts: ArtifactOwnerSummary[] }>(byPath(username, projectSlug), { cookie });
export const fetchArtifactMeta = (username: string, projectSlug: string, slug: string, cookie?: string) =>
  apiCall<ArtifactMeta>(byPath(username, projectSlug, slug), { cookie });
export const fetchArtifactVersions = (artifactId: string, cookie?: string) =>
  apiCall<{ versions: ArtifactVersion[] }>(artifactApi(artifactId, "versions"), { cookie });
export const fetchArtifactContent = (artifactId: string, cookie?: string, versionNumber?: number) =>
  apiCall<{ content: string; contentType: string }>(artifactApi(artifactId, "content"), {
    cookie, query: { version: versionNumber },
    parseOk: async (response) => ({ content: await response.text(), contentType: response.headers.get("content-type") ?? "text/plain" })
  });
export const fetchArtifactDiff = (artifactId: string, cookie: string | undefined, fromVersion: number, toVersion: number) =>
  apiCall<{ unifiedDiff: string; fromVersion: { versionNumber: number }; toVersion: { versionNumber: number } }>(
    artifactApi(artifactId, "diff"), { cookie, query: { from: fromVersion, to: toVersion } }
  );
export const fetchShareLinks = (artifactId: string, cookie: string) =>
  apiCall<{ shareLinks: ShareLinkSummary[] }>(artifactApi(artifactId, "share-links"), { cookie });
export const fetchAuditEvents = (cookie: string, opts?: { artifactId?: string; limit?: number }) =>
  apiCall<{ events: AuditEvent[] }>("/api/audit-events", { cookie, query: { artifactId: opts?.artifactId, limit: opts?.limit } });
export const fetchArtifactAccess = (artifactId: string, cookie: string) =>
  apiCall<{ publicView: boolean; publicEdit: boolean; viewerEmails: string[] }>(artifactApi(artifactId, "access"), { cookie });

export const fetchWorkspaces = (cookie: string) =>
  apiCall<{ workspaces: WorkspaceSummary[] }>("/api/workspaces", { cookie });

export const fetchWorkspace = (workspaceId: string, cookie: string) =>
  apiCall<{ workspace: Omit<WorkspaceSummary, "role"> }>(workspaceApi(workspaceId), { cookie });

export const fetchPublicWorkspaceBySlug = (slug: string, cookie?: string) =>
  apiCall<{ workspace: Omit<WorkspaceSummary, "role"> }>(`/api/workspaces/by-slug/${encodeURIComponent(slug)}`, {
    cookie
  });

export const createWorkspace = (cookie: string, body: { slug: string; name: string }) =>
  apiCall<{ workspace: WorkspaceSummary }>("/api/workspaces", { cookie, method: "POST", body });

export const fetchWorkspaceMembers = (workspaceId: string, cookie: string) =>
  apiCall<{ members: WorkspaceMemberSummary[] }>(`${workspaceApi(workspaceId)}/members`, { cookie });

export const updateWorkspaceMemberRole = (
  workspaceId: string,
  cookie: string,
  userId: string,
  role: WorkspaceRole
) =>
  apiCall<{ member: WorkspaceMemberSummary }>(`${workspaceApi(workspaceId)}/members/${encodeURIComponent(userId)}`, {
    cookie,
    method: "PATCH",
    body: { role }
  });

export const removeWorkspaceMember = (workspaceId: string, cookie: string, userId: string) =>
  apiCall<{ removed: true }>(`${workspaceApi(workspaceId)}/members/${encodeURIComponent(userId)}`, {
    cookie,
    method: "DELETE"
  });

export const fetchWorkspaceProjects = (workspaceId: string, cookie: string) =>
  apiCall<{ projects: WorkspaceProjectSummary[] }>(`${workspaceApi(workspaceId)}/projects`, { cookie });

export const fetchWorkspaceArtifacts = (workspaceId: string, cookie: string) =>
  apiCall<{ artifacts: WorkspaceArtifactSummary[] }>(`${workspaceApi(workspaceId)}/artifacts`, { cookie });

export const fetchWorkspaceProjectByPath = (workspaceId: string, projectSlug: string, cookie?: string) =>
  apiCall<{ project: WorkspaceProjectSummary; artifacts: WorkspaceArtifactSummary[] }>(
    `${workspaceApi(workspaceId)}/by-path/${encodeURIComponent(projectSlug)}`,
    { cookie }
  );

export const fetchWorkspaceArtifactMeta = (
  workspaceId: string,
  projectSlug: string,
  slug: string,
  cookie?: string
) =>
  apiCall<ArtifactMeta>(
    `${workspaceApi(workspaceId)}/by-path/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`,
    { cookie }
  );

export const fetchWorkspaceInvitations = (workspaceId: string, cookie: string) =>
  apiCall<{ invitations: WorkspaceInvitationSummary[] }>(`${workspaceApi(workspaceId)}/invitations`, { cookie });

export const fetchWorkspaceAuditEvents = (workspaceId: string, cookie: string, limit = 50) =>
  apiCall<{ events: AuditEvent[] }>(`${workspaceApi(workspaceId)}/audit-events`, { cookie, query: { limit } });

export const createWorkspaceInvitation = (
  workspaceId: string,
  cookie: string,
  body: { email: string; role: InvitableWorkspaceRole }
) =>
  apiCall<{ invitation: { id: string; acceptUrl: string; expiresAt: string } }>(
    `${workspaceApi(workspaceId)}/invitations`,
    { cookie, method: "POST", body }
  );

export const acceptWorkspaceInvitation = (cookie: string, token: string) =>
  apiCall<{ membership: { workspaceId: string; role: WorkspaceRole } }>("/api/workspace-invitations/accept", {
    cookie,
    method: "POST",
    body: { token }
  });

export const revokeWorkspaceInvitation = (cookie: string, invitationId: string) =>
  apiCall<{ revoked: true }>(`/api/workspace-invitations/${encodeURIComponent(invitationId)}/revoke`, {
    cookie,
    method: "POST"
  });

export const resendWorkspaceInvitation = (cookie: string, invitationId: string) =>
  apiCall<{ invitation: { id: string; acceptUrl: string; expiresAt: string } }>(
    `/api/workspace-invitations/${encodeURIComponent(invitationId)}/resend`,
    { cookie, method: "POST" }
  );

export async function resolveWorkspaceBySlug(
  cookie: string,
  slug: string
): Promise<ApiResult<{ workspace: WorkspaceSummary }>> {
  const result = await fetchWorkspaces(cookie);
  if (!result.ok) return result;

  const normalized = slug.trim().toLowerCase();
  const workspace = result.body.workspaces.find((row) => row.slug.toLowerCase() === normalized);
  if (!workspace) {
    return { ok: false, status: 404, message: "Workspace was not found." };
  }

  return { ok: true, status: 200, body: { workspace } };
}

export async function loadArtifactGate(
  username: string, projectSlug: string, slug: string, cookie: string | undefined, opts: { redirectPath: string }
): Promise<{ kind: "ok"; meta: ArtifactMeta } | { kind: "restricted"; message: string; loginHref: string }> {
  const result = await fetchArtifactMeta(username, projectSlug, slug, cookie);
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok && result.status === 403) {
    return { kind: "restricted", message: result.message, loginHref: `/login?next=${encodeURIComponent(opts.redirectPath)}` };
  }
  if (!result.ok) throw new Error(`Unexpected artifact response: ${result.status}`);
  return { kind: "ok", meta: result.body };
}

export async function loadWorkspaceArtifactGate(
  workspaceId: string,
  projectSlug: string,
  slug: string,
  cookie: string | undefined,
  opts: { redirectPath: string }
): Promise<{ kind: "ok"; meta: ArtifactMeta } | { kind: "restricted"; message: string; loginHref: string }> {
  const result = await fetchWorkspaceArtifactMeta(workspaceId, projectSlug, slug, cookie);
  if (!result.ok && result.status === 404) notFound();
  if (!result.ok && result.status === 403) {
    return { kind: "restricted", message: result.message, loginHref: `/login?next=${encodeURIComponent(opts.redirectPath)}` };
  }
  if (!result.ok) throw new Error(`Unexpected artifact response: ${result.status}`);
  return { kind: "ok", meta: result.body };
}
