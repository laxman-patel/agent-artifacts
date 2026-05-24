import {
  createArtifactInputSchema,
  createProjectInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import type { ApiClient } from "./client.js";
import { z } from "zod";

const versionNumberSchema = z.number().int().positive();

export async function getProfileMe(client: ApiClient) {
  return client.get("/api/profile/me");
}

export async function listProjects(client: ApiClient) {
  return client.get("/api/profile/projects");
}

export async function createProject(client: ApiClient, body: unknown) {
  return client.post("/api/projects", createProjectInputSchema.parse(body));
}

export async function checkProjectSlugAvailability(client: ApiClient, ownerUsername: string, slug: string) {
  return client.get(
    `/api/projects/slug-availability/${encodeURIComponent(ownerUsername)}/${encodeURIComponent(slug)}`
  );
}

export async function listArtifacts(client: ApiClient) {
  return client.get("/api/profile/artifacts");
}

export async function createArtifact(client: ApiClient, body: unknown) {
  return client.post("/api/artifacts", createArtifactInputSchema.parse(body));
}

export async function getArtifact(client: ApiClient, artifactId: string) {
  return client.get(`/api/artifacts/${encodeURIComponent(artifactId)}`);
}

export async function updateArtifact(client: ApiClient, artifactId: string, body: unknown) {
  return client.post(
    `/api/artifacts/${encodeURIComponent(artifactId)}/versions`,
    updateArtifactInputSchema.parse(body)
  );
}

export async function deleteArtifact(client: ApiClient, artifactId: string) {
  return client.delete(`/api/artifacts/${encodeURIComponent(artifactId)}`);
}

export async function getArtifactContent(client: ApiClient, artifactId: string, version?: number) {
  return client.request<string>("GET", `/api/artifacts/${encodeURIComponent(artifactId)}/content`, {
    query: version !== undefined ? { version } : undefined,
    rawText: true
  });
}

export async function listArtifactVersions(client: ApiClient, artifactId: string, limit?: number) {
  return client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/versions`, { limit });
}

export async function diffArtifactVersions(
  client: ApiClient,
  artifactId: string,
  fromVersion: number,
  toVersion: number
) {
  return client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/diff`, {
    from: fromVersion,
    to: toVersion
  });
}

export async function checkArtifactSlugAvailability(
  client: ApiClient,
  ownerUsername: string,
  projectSlug: string,
  slug: string
) {
  return client.get(
    `/api/artifacts/slug-availability/${encodeURIComponent(ownerUsername)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
  );
}

export async function getArtifactAccess(client: ApiClient, artifactId: string) {
  return client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/access`);
}

export async function setArtifactAccess(client: ApiClient, artifactId: string, body: unknown) {
  return client.patch(
    `/api/artifacts/${encodeURIComponent(artifactId)}/access`,
    setArtifactAccessInputSchema.parse(body)
  );
}

export async function setUsername(client: ApiClient, body: unknown) {
  return client.post("/api/profile/username", z.object({ username: z.string().min(1) }).parse(body));
}

export async function getProjectByPath(client: ApiClient, owner: string, projectSlug: string) {
  return client.get(`/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}`);
}

export async function getArtifactByPath(client: ApiClient, owner: string, projectSlug: string, slug: string) {
  return client.get(
    `/api/by-path/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
  );
}

export async function createShareLink(client: ApiClient, artifactId: string, body: unknown) {
  return client.post(`/api/artifacts/${encodeURIComponent(artifactId)}/share-links`, body);
}

export async function listShareLinks(client: ApiClient, artifactId: string) {
  return client.get(`/api/artifacts/${encodeURIComponent(artifactId)}/share-links`);
}

export async function revokeShareLink(client: ApiClient, shareLinkId: string) {
  return client.post(`/api/share-links/${encodeURIComponent(shareLinkId)}/revoke`, {});
}

export async function listAuditEvents(client: ApiClient, query?: { artifactId?: string; limit?: number }) {
  return client.get("/api/audit-events", query);
}

export async function previewArtifactUrl(client: ApiClient, owner: string, projectSlug: string, slug: string) {
  return client.get<{ url: string }>(
    `/api/slug-preview/${encodeURIComponent(owner)}/${encodeURIComponent(projectSlug)}/${encodeURIComponent(slug)}`
  );
}

export async function checkHealth(client: ApiClient) {
  return client.get<{ ok: boolean }>("/health");
}

export { versionNumberSchema };
