import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    emailUnique: uniqueIndex("user_email_unique").on(sql`lower(${table.email})`)
  })
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tokenUnique: uniqueIndex("session_token_unique").on(table.token),
    userIdx: index("session_user_idx").on(table.userId)
  })
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    userIdx: index("account_user_idx").on(table.userId),
    providerAccountUnique: uniqueIndex("account_provider_account_unique").on(table.providerId, table.accountId)
  })
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    identifierIdx: index("verification_identifier_idx").on(table.identifier)
  })
);

export const artifactType = pgEnum("artifact_type", ["html", "md", "jsx"]);
export const artifactState = pgEnum("artifact_state", ["active", "archived", "deleted"]);
export const artifactRole = pgEnum("artifact_role", ["owner", "admin", "editor", "viewer"]);
export const shareLinkRole = pgEnum("share_link_role", ["viewer", "editor"]);
// Principal types. Currently produced by the auth layer:
//   - "user"    — Better Auth session (cookie or bearer-resolved)
//   - "service" — anonymous public-viewer fallback
// Reserved for future capabilities (no auth path currently produces them):
//   - "agent", "api_key", "oauth_client"
export const principalType = pgEnum("principal_type", ["user", "agent", "api_key", "oauth_client", "service"]);
export const permissionSubjectType = pgEnum("permission_subject_type", [
  "anyone",
  "user",
  "email",
  "agent",
  "api_key",
  "share_link"
]);

export const userProfiles = pgTable(
  "user_profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 32 }).notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    usernameUnique: uniqueIndex("user_profiles_username_unique").on(sql`lower(${table.username})`),
    usernameFormat: check(
      "user_profiles_username_format",
      sql`${table.username} ~ '^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$' AND length(${table.username}) BETWEEN 3 AND 32`
    )
  })
);

export const workspaceKind = pgEnum("workspace_kind", ["personal", "team"]);
export const workspaceState = pgEnum("workspace_state", ["active", "archived"]);
export const workspaceRole = pgEnum("workspace_role", [
  "owner",
  "admin",
  "member",
  "viewer",
  "billing_admin"
]);
export const workspaceInvitationState = pgEnum("workspace_invitation_state", [
  "pending",
  "accepted",
  "revoked",
  "expired"
]);

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    slug: varchar("slug", { length: 32 }).notNull(),
    name: text("name").notNull(),
    kind: workspaceKind("kind").notNull(),
    state: workspaceState("state").default("active").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    personalUserId: text("personal_user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    slugUnique: uniqueIndex("workspaces_slug_unique").on(sql`lower(${table.slug})`),
    personalUserUnique: uniqueIndex("workspaces_personal_user_unique").on(table.personalUserId),
    slugFormat: check(
      "workspaces_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$' AND length(${table.slug}) BETWEEN 3 AND 32`
    )
  })
);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workspaceUserUnique: uniqueIndex("workspace_members_workspace_user_unique").on(
      table.workspaceId,
      table.userId
    ),
    workspaceIdx: index("workspace_members_workspace_idx").on(table.workspaceId),
    userIdx: index("workspace_members_user_idx").on(table.userId)
  })
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRole("role").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: workspaceInvitationState("state").default("pending").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tokenUnique: uniqueIndex("workspace_invitations_token_hash_unique").on(table.tokenHash),
    workspaceIdx: index("workspace_invitations_workspace_idx").on(table.workspaceId),
    emailIdx: index("workspace_invitations_email_idx").on(sql`lower(${table.email})`)
  })
);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerSlugUnique: uniqueIndex("projects_owner_slug_unique").on(table.ownerUserId, sql`lower(${table.slug})`),
    ownerIdx: index("projects_owner_idx").on(table.ownerUserId),
    workspaceIdx: index("projects_workspace_idx").on(table.workspaceId),
    workspaceSlugUnique: uniqueIndex("projects_workspace_slug_unique")
      .on(table.workspaceId, sql`lower(${table.slug})`)
      .where(sql`${table.workspaceId} IS NOT NULL`),
    slugFormat: check(
      "projects_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${table.slug}) BETWEEN 1 AND 80`
    )
  })
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    type: artifactType("type").notNull(),
    state: artifactState("state").default("active").notNull(),
    latestVersionId: text("latest_version_id"),
    createdByPrincipalType: principalType("created_by_principal_type").notNull(),
    createdByPrincipalId: text("created_by_principal_id").notNull(),
    publicView: boolean("public_view").default(true).notNull(),
    publicEdit: boolean("public_edit").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true })
  },
  (table) => ({
    projectSlugUnique: uniqueIndex("artifacts_project_slug_unique").on(table.projectId, sql`lower(${table.slug})`),
    ownerIdx: index("artifacts_owner_idx").on(table.ownerUserId),
    projectIdx: index("artifacts_project_idx").on(table.projectId),
    slugFormat: check(
      "artifacts_slug_format",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${table.slug}) BETWEEN 1 AND 80`
    )
  })
);

export const artifactVersions = pgTable(
  "artifact_versions",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    parentVersionId: text("parent_version_id"),
    contentObjectKey: text("content_object_key").notNull(),
    contentSha256: varchar("content_sha256", { length: 64 }).notNull(),
    contentBytes: integer("content_bytes").notNull(),
    changelog: text("changelog"),
    createdByPrincipalType: principalType("created_by_principal_type").notNull(),
    createdByPrincipalId: text("created_by_principal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    artifactVersionUnique: uniqueIndex("artifact_versions_artifact_version_unique").on(
      table.artifactId,
      table.versionNumber
    ),
    artifactIdx: index("artifact_versions_artifact_idx").on(table.artifactId)
  })
);

export const artifactPermissions = pgTable(
  "artifact_permissions",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    subjectType: permissionSubjectType("subject_type").notNull(),
    subjectId: text("subject_id"),
    email: text("email"),
    role: artifactRole("role").notNull(),
    createdByPrincipalType: principalType("created_by_principal_type").notNull(),
    createdByPrincipalId: text("created_by_principal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => ({
    artifactIdx: index("artifact_permissions_artifact_idx").on(table.artifactId),
    subjectIdx: index("artifact_permissions_subject_idx").on(table.subjectType, table.subjectId),
    emailIdx: index("artifact_permissions_email_idx").on(sql`lower(${table.email})`)
  })
);

export const shareLinks = pgTable(
  "share_links",
  {
    id: text("id").primaryKey(),
    artifactId: text("artifact_id")
      .notNull()
      .references(() => artifacts.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    role: shareLinkRole("role").notNull(),
    createdByPrincipalType: principalType("created_by_principal_type").notNull(),
    createdByPrincipalId: text("created_by_principal_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true })
  },
  (table) => ({
    tokenUnique: uniqueIndex("share_links_token_hash_unique").on(table.tokenHash),
    artifactIdx: index("share_links_artifact_idx").on(table.artifactId)
  })
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
    artifactId: text("artifact_id"),
    actorPrincipalType: principalType("actor_principal_type").notNull(),
    actorPrincipalId: text("actor_principal_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerIdx: index("audit_events_owner_idx").on(table.ownerUserId),
    workspaceIdx: index("audit_events_workspace_idx").on(table.workspaceId),
    artifactIdx: index("audit_events_artifact_idx").on(table.artifactId)
  })
);

