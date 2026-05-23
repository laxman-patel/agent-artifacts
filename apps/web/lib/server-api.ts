export function internalApiOrigin(): string {
  return (process.env.INTERNAL_API_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
}

export function cookieHeader(cookieStore: { getAll(): { name: string; value: string }[] }): string {
  return cookieStore.getAll().map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export interface ProfileMeResponse {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
  };
  profile: {
    username: string;
    displayName: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface ProjectSummary {
  id: string;
  ownerUsername: string;
  slug: string;
  title: string;
  description: string | null;
  updatedAt: string;
}

export interface ArtifactOwnerSummary {
  id: string;
  ownerUsername: string;
  projectId: string;
  projectSlug: string;
  slug: string;
  title: string;
  type: string;
  updatedAt: string;
}

export function artifactPath(artifact: { ownerUsername: string; projectSlug: string; slug: string }): string {
  return `/${artifact.ownerUsername}/projects/${artifact.projectSlug}/${artifact.slug}`;
}

export function projectPath(project: { ownerUsername: string; slug: string }): string {
  return `/${project.ownerUsername}/projects/${project.slug}`;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as { message?: string };
  return body.message ?? response.statusText;
}

export async function fetchProfileMe(cookieHeaderValue: string): Promise<{
  status: number;
  body?: ProfileMeResponse;
  message?: string;
}> {
  const response = await fetch(`${internalApiOrigin()}/api/profile/me`, {
    headers: { cookie: cookieHeaderValue },
    cache: "no-store"
  });

  if (!response.ok) {
    return { status: response.status, message: await readApiError(response) };
  }

  return { status: response.status, body: (await response.json()) as ProfileMeResponse };
}

export async function fetchOwnedProjects(cookieHeaderValue: string): Promise<{
  status: number;
  body?: { projects: ProjectSummary[] };
  message?: string;
}> {
  const response = await fetch(`${internalApiOrigin()}/api/profile/projects`, {
    headers: { cookie: cookieHeaderValue },
    cache: "no-store"
  });

  if (!response.ok) {
    return { status: response.status, message: await readApiError(response) };
  }

  return { status: response.status, body: (await response.json()) as { projects: ProjectSummary[] } };
}

export async function fetchOwnedArtifacts(cookieHeaderValue: string): Promise<{
  status: number;
  body?: { artifacts: ArtifactOwnerSummary[] };
  message?: string;
}> {
  const response = await fetch(`${internalApiOrigin()}/api/profile/artifacts`, {
    headers: { cookie: cookieHeaderValue },
    cache: "no-store"
  });

  if (!response.ok) {
    return { status: response.status, message: await readApiError(response) };
  }

  return { status: response.status, body: (await response.json()) as { artifacts: ArtifactOwnerSummary[] } };
}

export interface ArtifactMeta {
  id: string;
  ownerUserId: string;
  ownerUsername: string;
  projectId: string;
  projectSlug: string;
  slug: string;
  title: string;
  description: string | null;
  type: "html" | "markdown" | "react";
  publicView: boolean;
  publicEdit: boolean;
  latestVersionId: string | null;
  updatedAt: string;
}

export async function fetchProjectByPath(
  username: string,
  projectSlug: string,
  cookieHeaderValue: string | undefined
) {
  const headers: HeadersInit = {};
  if (cookieHeaderValue) {
    headers.cookie = cookieHeaderValue;
  }

  const response = await fetch(
    `${internalApiOrigin()}/api/by-path/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectSlug)}`,
    { headers, cache: "no-store" }
  );

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  return {
    ok: true as const,
    body: (await response.json()) as { project: ProjectSummary; artifacts: ArtifactOwnerSummary[] }
  };
}

export async function fetchArtifactMeta(
  username: string,
  projectSlug: string,
  slug: string,
  cookieHeaderValue: string | undefined
) {
  const headers: HeadersInit = {};
  if (cookieHeaderValue) {
    headers.cookie = cookieHeaderValue;
  }

  const response = await fetch(
    `${internalApiOrigin()}/api/by-path/${encodeURIComponent(username)}/projects/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`,
    {
      headers,
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };

    return {
      ok: false as const,
      status: response.status,
      message: body.message ?? response.statusText
    };
  }

  return { ok: true as const, artifact: (await response.json()) as ArtifactMeta };
}

export async function fetchArtifactVersions(artifactId: string, cookieHeaderValue: string | undefined) {
  const headers: HeadersInit = {};
  if (cookieHeaderValue) {
    headers.cookie = cookieHeaderValue;
  }

  const response = await fetch(`${internalApiOrigin()}/api/artifacts/${encodeURIComponent(artifactId)}/versions`, {
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  return {
    ok: true as const,
    body: (await response.json()) as {
      versions: Array<{
        id: string;
        versionNumber: number;
        changelog: string | null;
        createdAt: string;
      }>;
    }
  };
}

export async function fetchArtifactContent(
  artifactId: string,
  cookieHeaderValue: string | undefined,
  versionNumber?: number
) {
  const url = new URL(`${internalApiOrigin()}/api/artifacts/${encodeURIComponent(artifactId)}/content`);
  if (versionNumber !== undefined) {
    url.searchParams.set("version", String(versionNumber));
  }

  const headers: HeadersInit = {};
  if (cookieHeaderValue) {
    headers.cookie = cookieHeaderValue;
  }

  const response = await fetch(url, { headers, cache: "no-store" });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  const content = await response.text();
  const contentType = response.headers.get("content-type") ?? "text/plain";

  return { ok: true as const, content, contentType };
}

export async function fetchArtifactDiff(
  artifactId: string,
  cookieHeaderValue: string | undefined,
  fromVersion: number,
  toVersion: number
) {
  const url = new URL(`${internalApiOrigin()}/api/artifacts/${encodeURIComponent(artifactId)}/diff`);
  url.searchParams.set("from", String(fromVersion));
  url.searchParams.set("to", String(toVersion));

  const headers: HeadersInit = {};
  if (cookieHeaderValue) {
    headers.cookie = cookieHeaderValue;
  }

  const response = await fetch(url, { headers, cache: "no-store" });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  return {
    ok: true as const,
    body: (await response.json()) as {
      unifiedDiff: string;
      fromVersion: { versionNumber: number };
      toVersion: { versionNumber: number };
    }
  };
}

export async function fetchShareLinks(artifactId: string, cookieHeaderValue: string) {
  const response = await fetch(
    `${internalApiOrigin()}/api/artifacts/${encodeURIComponent(artifactId)}/share-links`,
    { headers: { cookie: cookieHeaderValue }, cache: "no-store" }
  );

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  return {
    ok: true as const,
    body: (await response.json()) as {
      shareLinks: Array<{
        id: string;
        role: string;
        createdAt: string;
        expiresAt: string | null;
        revokedAt: string | null;
        lastUsedAt: string | null;
      }>;
    }
  };
}

export async function fetchAuditEvents(
  cookieHeaderValue: string,
  opts?: { artifactId?: string; limit?: number }
) {
  const url = new URL(`${internalApiOrigin()}/api/audit-events`);
  if (opts?.artifactId) url.searchParams.set("artifactId", opts.artifactId);
  if (opts?.limit) url.searchParams.set("limit", String(opts.limit));

  const response = await fetch(url, { headers: { cookie: cookieHeaderValue }, cache: "no-store" });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  return {
    ok: true as const,
    body: (await response.json()) as {
      events: Array<{
        id: string;
        artifactId: string | null;
        actorPrincipalType: string;
        actorPrincipalId: string;
        action: string;
        targetType: string;
        targetId: string;
        metadata: Record<string, unknown>;
        createdAt: string;
      }>;
    }
  };
}

export async function fetchArtifactAccess(artifactId: string, cookieHeaderValue: string) {
  const response = await fetch(`${internalApiOrigin()}/api/artifacts/${encodeURIComponent(artifactId)}/access`, {
    headers: { cookie: cookieHeaderValue },
    cache: "no-store"
  });

  if (!response.ok) {
    return { ok: false as const, status: response.status };
  }

  return {
    ok: true as const,
    body: (await response.json()) as { publicView: boolean; publicEdit: boolean; viewerEmails: string[] }
  };
}
