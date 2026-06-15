import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
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

export const oauthApplications = pgTable(
  "oauth_application",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    icon: text("icon"),
    metadata: text("metadata"),
    clientId: text("client_id").notNull(),
    clientSecret: text("client_secret"),
    redirectUrls: text("redirect_urls").notNull(),
    type: text("type").notNull(),
    disabled: boolean("disabled").default(false).notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    clientIdUnique: uniqueIndex("oauth_application_client_id_unique").on(table.clientId),
    userIdx: index("oauth_application_user_idx").on(table.userId)
  })
);

export const oauthAccessTokens = pgTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token").notNull(),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }).notNull(),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }).notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplications.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    accessTokenUnique: uniqueIndex("oauth_access_token_access_token_unique").on(table.accessToken),
    refreshTokenUnique: uniqueIndex("oauth_access_token_refresh_token_unique").on(table.refreshToken),
    clientIdx: index("oauth_access_token_client_idx").on(table.clientId),
    userIdx: index("oauth_access_token_user_idx").on(table.userId)
  })
);

export const oauthConsents = pgTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthApplications.clientId, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scopes: text("scopes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    consentGiven: boolean("consent_given").notNull()
  },
  (table) => ({
    clientIdx: index("oauth_consent_client_idx").on(table.clientId),
    userIdx: index("oauth_consent_user_idx").on(table.userId)
  })
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    scopes: jsonb("scopes").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("api_keys_token_hash_unique").on(table.tokenHash),
    userIdx: index("api_keys_user_idx").on(table.userId),
    activeUserIdx: index("api_keys_active_user_idx").on(table.userId, table.revokedAt)
  })
);

export const agentRegistrationType = pgEnum("agent_registration_type", ["service_auth", "anonymous"]);
export const agentRegistrationStatus = pgEnum("agent_registration_status", ["pending", "claimed", "revoked", "expired"]);
export const agentAccessTokenKind = pgEnum("agent_access_token_kind", ["pre_claim", "post_claim"]);

export const agentRegistrations = pgTable(
  "agent_registrations",
  {
    id: text("id").primaryKey(),
    type: agentRegistrationType("type").notNull(),
    status: agentRegistrationStatus("status").default("pending").notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    loginHint: text("login_hint"),
    providerIssuer: text("provider_issuer"),
    providerSubject: text("provider_subject"),
    requestedScopes: jsonb("requested_scopes").$type<string[]>().default([]).notNull(),
    grantedScopes: jsonb("granted_scopes").$type<string[]>().default([]).notNull(),
    claimTokenHash: varchar("claim_token_hash", { length: 64 }).notNull(),
    claimAttemptTokenHash: varchar("claim_attempt_token_hash", { length: 64 }),
    userCodeHash: varchar("user_code_hash", { length: 64 }),
    assertionJtiHash: varchar("assertion_jti_hash", { length: 64 }),
    claimRequestedAt: timestamp("claim_requested_at", { withTimezone: true }),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    claimExpiresAt: timestamp("claim_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastIssuedAt: timestamp("last_issued_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    claimTokenUnique: uniqueIndex("agent_registrations_claim_token_hash_unique").on(table.claimTokenHash),
    claimAttemptTokenUnique: uniqueIndex("agent_registrations_claim_attempt_token_hash_unique").on(table.claimAttemptTokenHash),
    userCodeIdx: index("agent_registrations_user_code_idx").on(table.userCodeHash),
    ownerIdx: index("agent_registrations_owner_idx").on(table.ownerUserId),
    loginHintIdx: index("agent_registrations_login_hint_idx").on(sql`lower(${table.loginHint})`),
    activeIdx: index("agent_registrations_active_idx").on(table.status, table.revokedAt, table.expiresAt),
    assertionJtiUnique: uniqueIndex("agent_registrations_assertion_jti_hash_unique").on(table.assertionJtiHash)
  })
);

export const agentAccessTokens = pgTable(
  "agent_access_tokens",
  {
    id: text("id").primaryKey(),
    registrationId: text("registration_id")
      .notNull()
      .references(() => agentRegistrations.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id").references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    tokenKind: agentAccessTokenKind("token_kind").notNull(),
    scopes: jsonb("scopes").$type<string[]>().default([]).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("agent_access_tokens_token_hash_unique").on(table.tokenHash),
    registrationIdx: index("agent_access_tokens_registration_idx").on(table.registrationId),
    activeTokenIdx: index("agent_access_tokens_active_token_idx").on(table.tokenHash, table.revokedAt, table.expiresAt),
    ownerIdx: index("agent_access_tokens_owner_idx").on(table.ownerUserId)
  })
);

export const agentDelegations = pgTable(
  "agent_delegations",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    subject: text("subject").notNull(),
    audience: text("audience").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => ({
    issuerSubjectAudienceUnique: uniqueIndex("agent_delegations_issuer_subject_audience_unique").on(
      table.issuer,
      table.subject,
      table.audience
    ),
    userIdx: index("agent_delegations_user_idx").on(table.userId)
  })
);

export const apiRateLimits = pgTable("api_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(0).notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const artifactType = pgEnum("artifact_type", ["html", "md", "jsx"]);
export const artifactState = pgEnum("artifact_state", ["active", "deleted"]);
export const artifactRole = pgEnum("artifact_role", ["owner", "admin", "editor", "viewer"]);
export const shareLinkRole = pgEnum("share_link_role", ["viewer", "editor"]);
export const billingPlan = pgEnum("billing_plan", ["free", "builder", "studio"]);
export const billingSubscriptionStatus = pgEnum("billing_subscription_status", [
  "active",
  "trialing",
  "on_hold",
  "cancelled",
  "expired",
  "failed"
]);
export const billingUsageMeter = pgEnum("billing_usage_meter", [
  "artifact.storage_gb_days",
  "artifact.delivery_gb",
  "artifact.version_write"
]);
// Principal types. Currently produced by the auth layer:
//   - "user"    — Better Auth session (cookie or bearer-resolved)
//   - "service" — anonymous public-viewer fallback
// Reserved for future capabilities (no auth path currently produces them):
//   - "agent", "api_key", "oauth_client"
export const principalType = pgEnum("principal_type", ["user", "agent", "api_key", "oauth_client", "service"]);
export const workspaceKind = pgEnum("workspace_kind", ["personal", "team"]);
export const workspaceState = pgEnum("workspace_state", ["active", "archived"]);
export const workspaceRole = pgEnum("workspace_role", ["owner", "admin", "member", "viewer", "billing_admin"]);
export const workspaceInvitationState = pgEnum("workspace_invitation_state", ["pending", "accepted", "revoked", "expired"]);
export const permissionSubjectType = pgEnum("permission_subject_type", [
  "anyone",
  "user",
  "email"
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
    workspaceUserUnique: uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId),
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
    tokenHashUnique: uniqueIndex("workspace_invitations_token_hash_unique").on(table.tokenHash),
    workspaceIdx: index("workspace_invitations_workspace_idx").on(table.workspaceId),
    emailIdx: index("workspace_invitations_email_idx").on(sql`lower(${table.email})`)
  })
);

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

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    icon: text("icon"),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    workspaceSlugUnique: uniqueIndex("projects_workspace_slug_unique").on(table.workspaceId, sql`lower(${table.slug})`),
    ownerIdx: index("projects_owner_idx").on(table.ownerUserId),
    workspaceIdx: index("projects_workspace_idx").on(table.workspaceId),
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
    thumbnailObjectKey: text("thumbnail_object_key"),
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
    thumbnailObjectKey: text("thumbnail_object_key"),
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
    workspaceId: text("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
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

export const billingAccounts = pgTable(
  "billing_accounts",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: billingPlan("plan_id").default("free").notNull(),
    status: billingSubscriptionStatus("status").default("active").notNull(),
    dodoCustomerId: text("dodo_customer_id"),
    dodoSubscriptionId: text("dodo_subscription_id"),
    dodoProductId: text("dodo_product_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    customerIdx: index("billing_accounts_dodo_customer_idx").on(table.dodoCustomerId),
    subscriptionUnique: uniqueIndex("billing_accounts_dodo_subscription_unique").on(table.dodoSubscriptionId)
  })
);

export const billingWebhookEvents = pgTable("billing_webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull()
});

export const billingUsageEvents = pgTable(
  "billing_usage_events",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    meter: billingUsageMeter("meter").notNull(),
    quantity: numeric("quantity", { precision: 18, scale: 6 }).notNull(),
    dodoEventId: text("dodo_event_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, string>>().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    ownerMeterIdx: index("billing_usage_events_owner_meter_idx").on(table.ownerUserId, table.meter),
    dodoEventUnique: uniqueIndex("billing_usage_events_dodo_event_unique").on(table.dodoEventId)
  })
);

