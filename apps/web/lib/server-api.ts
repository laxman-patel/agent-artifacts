import { notFound } from "next/navigation";

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
  title: string; description: string | null; type: "html" | "markdown" | "react"; publicView: boolean; publicEdit: boolean;
  latestVersionId: string | null; updatedAt: string;
}

export function internalApiOrigin(): string {
  return (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
}

export function cookieHeader(cookieStore: { getAll(): { name: string; value: string }[] }): string {
  return cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function apiCall<T>(path: string, opts: ApiCallOptions = {}): Promise<ApiResult<T>> {
  const url = new URL(`${internalApiOrigin()}${path}`);
  if (opts.query) for (const [key, value] of Object.entries(opts.query)) if (value !== undefined) url.searchParams.set(key, String(value));
  const headers: Record<string, string> = {};
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(url, {
    method: opts.method ?? "GET", headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store"
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    return { ok: false, status: response.status, message: (errBody as { message?: string }).message ?? response.statusText };
  }
  const body = opts.parseOk ? await opts.parseOk(response) : opts.accept === "text" ? await response.text() : await response.json();
  return { ok: true, status: response.status, body: body as T };
}

export function artifactPath(artifact: ArtifactRoute): string {
  return `/${artifact.ownerUsername}/${artifact.projectSlug}/${artifact.slug}`;
}

export function projectPath(project: OwnerRoute): string {
  return `/${project.ownerUsername}/${project.slug}`;
}

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
