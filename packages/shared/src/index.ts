import { z } from "zod";

export { readCookie, readSessionCookie, SESSION_COOKIE_NAMES } from "./cookie.js";

export const artifactTypeSchema = z.enum(["html", "md", "jsx"]);
export type ArtifactType = z.infer<typeof artifactTypeSchema>;

export const artifactRoleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type ArtifactRole = z.infer<typeof artifactRoleSchema>;

export const shareLinkRoleSchema = z.enum(["viewer", "editor"]);
export type ShareLinkRole = z.infer<typeof shareLinkRoleSchema>;

export const principalTypeSchema = z.enum(["user", "agent", "api_key", "oauth_client", "service"]);
export type PrincipalType = z.infer<typeof principalTypeSchema>;

export const artifactActionSchema = z.enum([
  "artifact.view",
  "artifact.create",
  "project.view",
  "artifact.update",
  "artifact.restore",
  "artifact.diff",
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

export interface Principal {
  type: PrincipalType;
  id: string;
  ownerUserId?: string;
  email?: string;
  scopes: AgentScope[];
  // Per-artifact role grants resolved from share-link cookies. Augments the
  // effective role computed from the artifact's own permission rules.
  artifactRoleGrants?: Record<string, ArtifactRole>;
}

/**
 * The id of the human account a principal acts on behalf of.
 *
 * For a signed-in `user`, that's their own id. For non-human credentials
 * (`api_key`, `agent`, `oauth_client`) it's the `ownerUserId` the credential
 * was issued for. Anonymous/service principals have no owner and return
 * `undefined`. Use this instead of reading `principal.id` directly so an API
 * key can resolve and act as its owner (e.g. `whoami`, listing owned
 * resources, inferring the owner when publishing).
 */
export function principalUserId(principal: Principal): string | undefined {
  if (principal.type === "user") {
    return principal.id;
  }
  return principal.ownerUserId;
}

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

export const RESERVED_USERNAMES = new Set<string>([
  // App routes
  "login", "logout", "signup", "signin", "signout", "auth",
  "dashboard", "settings", "account", "profile", "preferences",
  "share", "shares", "admin", "support", "help", "docs",
  "about", "terms", "privacy", "legal", "security", "team-invite", "teams", "workspace-invite", "workspaces", "app", "w",
  // API/infra paths
  "api", "mcp", "static", "assets", "public", "_next",
  "www", "mail", "ftp", "root", "system",
  // Reserved words that could break things
  "null", "undefined", "true", "false",
  // Reserved for app branding / future
  "agent", "agents", "artifact", "artifacts", "official",
  // Project routes
  "projects", "project"
]);

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/, "Use lowercase letters, numbers, underscores, or hyphens.")
  .refine((value) => !RESERVED_USERNAMES.has(value.toLowerCase()), "This username is reserved.");

export const workspaceSlugSchema = usernameSchema;

export const workspaceRoleSchema = z.enum(["owner", "admin", "member", "viewer", "billing_admin"]);
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const workspaceActionSchema = z.enum([
  "workspace.view",
  "workspace.update",
  "workspace.manage_members",
  "workspace.manage_billing",
  "workspace.create_content",
  "workspace.delete"
]);
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>;

export const workspaceKindSchema = z.enum(["personal", "team"]);
export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;

export class WorkspaceForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "WorkspaceForbiddenError";
  }
}

export class WorkspaceNotFoundError extends Error {
  constructor() {
    super("Team was not found.");
    this.name = "WorkspaceNotFoundError";
  }
}

export class WorkspaceSlugUnavailableError extends Error {
  constructor(slug: string) {
    super(`Team slug "${slug}" is not available.`);
    this.name = "WorkspaceSlugUnavailableError";
  }
}

export function buildWorkspaceUrl(appUrl: string, workspaceSlug: string): string {
  const base = appUrl.replace(/\/+$/, "");
  return `${base}/${workspaceSlug}`;
}

export function buildWorkspaceProjectUrl(appUrl: string, workspaceSlug: string, projectSlug: string): string {
  return `${buildWorkspaceUrl(appUrl, workspaceSlug)}/${projectSlug}`;
}

export function buildWorkspaceProjectArtifactUrl(
  appUrl: string,
  workspaceSlug: string,
  projectSlug: string,
  artifactSlug: string
): string {
  return `${buildWorkspaceProjectUrl(appUrl, workspaceSlug, projectSlug)}/${artifactSlug}`;
}

export class ArtifactForbiddenError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ArtifactForbiddenError";
  }
}

