import { z } from "zod";

export const artifactTypeSchema = z.enum(["html", "markdown", "react"]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactStateSchema = z.enum(["active", "archived", "deleted"]);
export type ArtifactState = z.infer<typeof artifactStateSchema>;

export const artifactRoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type ArtifactRole = z.infer<typeof artifactRoleSchema>;

export const shareLinkRoleSchema = z.enum(["viewer", "editor"]);
export type ShareLinkRole = z.infer<typeof shareLinkRoleSchema>;

export const principalTypeSchema = z.enum(["user", "agent", "api_key", "oauth_client", "service"]);
export type PrincipalType = z.infer<typeof principalTypeSchema>;

export const permissionSubjectTypeSchema = z.enum([
  "anyone",
  "user",
  "email",
  "agent",
  "api_key",
  "share_link"
]);
export type PermissionSubjectType = z.infer<typeof permissionSubjectTypeSchema>;

export const artifactActionSchema = z.enum([
  "artifact.view",
  "artifact.create",
  "artifact.update",
  "artifact.restore",
  "artifact.fork",
  "artifact.diff",
  "artifact.archive",
  "artifact.delete",
  "artifact.manage_access",
  "artifact.create_share_link",
  "artifact.revoke_share_link",
  "account.manage_agents",
  "account.manage_api_keys"
]);
export type ArtifactAction = z.infer<typeof artifactActionSchema>;

export const agentScopeSchema = z.enum([
  "artifacts:read",
  "artifacts:create",
  "artifacts:update",
  "artifacts:delete",
  "artifacts:share",
  "artifacts:access:read",
  "artifacts:access:write",
  "agents:manage"
]);
export type AgentScope = z.infer<typeof agentScopeSchema>;

export const principalSchema = z.object({
  type: principalTypeSchema,
  id: z.string().min(1),
  ownerUserId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  scopes: z.array(agentScopeSchema).default([])
});
export type Principal = z.infer<typeof principalSchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, "Use lowercase letters, numbers, underscores, or hyphens.");

export function buildArtifactUrl(appUrl: string, username: string, slug: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/${username}/${slug}`;
}
