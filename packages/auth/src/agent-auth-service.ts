import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import {
  agentAccessTokens,
  agentRegistrations,
  auditEvents,
  users,
  type Database
} from "@agent-artifacts/db";
import { agentScopeSchema, type AgentScope, type Principal } from "@agent-artifacts/shared";

export const AGENT_ACCESS_TOKEN_PREFIX = "aa_at_";
export const AGENT_CLAIM_TOKEN_PREFIX = "aa_claim_";
export const AGENT_AUTH_CLAIM_GRANT = "urn:agent-artifacts:params:oauth:grant-type:claim_token";
export const JWT_BEARER_GRANT = "urn:ietf:params:oauth:grant-type:jwt-bearer";

export const agentRegistrationTypeSchema = z.enum(["service_auth", "anonymous"]);
export const agentTokenKindSchema = z.enum(["pre_claim", "post_claim"]);

const loginHintSchema = z.email().transform((value) => value.trim().toLowerCase());

export const agentIdentityInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("service_auth"),
    login_hint: loginHintSchema,
    scopes: z.array(agentScopeSchema).optional()
  }),
  z.object({
    type: z.literal("anonymous"),
    scopes: z.array(agentScopeSchema).optional()
  })
]);

export const agentIdentityClaimInputSchema = z.object({
  claim_token: z.string().min(1),
  login_hint: loginHintSchema
});

export const agentClaimCompleteInputSchema = z.object({
  user_code: z.string().trim().min(1)
});

export type AgentIdentityInput = z.infer<typeof agentIdentityInputSchema>;
export type AgentIdentityClaimInput = z.infer<typeof agentIdentityClaimInputSchema>;
export type AgentClaimCompleteInput = z.infer<typeof agentClaimCompleteInputSchema>;
export type AgentRegistrationType = z.infer<typeof agentRegistrationTypeSchema>;
export type AgentTokenKind = z.infer<typeof agentTokenKindSchema>;

type AgentRegistration = typeof agentRegistrations.$inferSelect;
type AgentAccessToken = typeof agentAccessTokens.$inferSelect;

export interface AgentAuthConfig {
  enabled: boolean;
  issuer: string;
  audience: string;
  appUrl: string;
  signingSecret: string;
  allowedScopes: AgentScope[];
  anonymousPreClaimScopes: AgentScope[];
  claimTtlSeconds: number;
  accessTokenTtlSeconds: number;
  preClaimAccessTokenTtlSeconds: number;
  identityAssertionTtlSeconds: number;
}

export interface AgentAuthRequestMetadata {
  ip?: string;
  userAgent?: string;
}

export interface CreatedAgentIdentity {
  type: AgentRegistrationType;
  registration_id: string;
  claim_token: string;
  expires_in: number;
  verification_uri: string;
  token_endpoint: string;
  revocation_endpoint: string;
  claim?: {
    user_code: string;
    verification_uri_complete: string;
  };
  identity_assertion?: string;
  scope: string;
  unclaimed: boolean;
}

export interface ClaimedAgentIdentity {
  registration_id: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
}

export interface CompletedAgentClaim {
  registration_id: string;
  owner_user_id: string;
  revoked_pre_claim_tokens: number;
}

export interface IssuedAgentAccessToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  registration_id: string;
  owner_user_id?: string;
  unclaimed: boolean;
  identity_assertion: string;
}

export class AgentAuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "AgentAuthError";
  }
}

const DEFAULT_SCOPES: AgentScope[] = ["artifacts:read"];
const emailRateLimits = new Map<string, { count: number; resetAt: number }>();
const registrationRateLimits = new Map<string, { count: number; resetAt: number }>();
const EMAIL_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const EMAIL_RATE_LIMIT_MAX = 5;
const REGISTRATION_RATE_LIMIT_WINDOW_MS = 60_000;
const REGISTRATION_RATE_LIMIT_MAX = 10;

export function hashAgentAuthSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeAgentScopes(input: {
  requestedScopes?: AgentScope[];
  allowedScopes: AgentScope[];
  defaultScopes?: AgentScope[];
}): AgentScope[] {
  const requested = input.requestedScopes?.length ? input.requestedScopes : (input.defaultScopes ?? DEFAULT_SCOPES);
  const allowed = new Set(input.allowedScopes);
  return [...new Set(requested)].filter((scope) => allowed.has(scope));
}

function token(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function userCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function secondsFromNow(seconds: number, now = new Date()): Date {
  return new Date(now.getTime() + seconds * 1000);
}

function scopeString(scopes: AgentScope[]): string {
  return scopes.join(" ");
}

function verificationUri(appUrl: string): string {
  return `${appUrl.replace(/\/+$/, "")}/agent/claim`;
}

function verificationUriComplete(appUrl: string, code: string): string {
  return `${verificationUri(appUrl)}?user_code=${encodeURIComponent(code)}`;
}

function endpoint(appUrl: string, path: string): string {
  return `${appUrl.replace(/\/+$/, "")}${path}`;
}

function assertEnabled(config: AgentAuthConfig) {
  if (!config.enabled) {
    throw new AgentAuthError("auth_md_disabled", "auth.md agent registration is disabled.", 404);
  }
}

function checkEmailRateLimit(loginHint: string) {
  const key = loginHint.toLowerCase();
  const now = Date.now();
  const existing = emailRateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    emailRateLimits.set(key, { count: 1, resetAt: now + EMAIL_RATE_LIMIT_WINDOW_MS });
    return;
  }
  existing.count++;
  if (existing.count > EMAIL_RATE_LIMIT_MAX) {
    throw new AgentAuthError("too_many_requests", "Too many claim attempts for this email.", 429);
  }
}

function checkRegistrationRateLimit(registrationId: string) {
  const now = Date.now();
  const existing = registrationRateLimits.get(registrationId);
  if (!existing || existing.resetAt <= now) {
    registrationRateLimits.set(registrationId, { count: 1, resetAt: now + REGISTRATION_RATE_LIMIT_WINDOW_MS });
    return;
  }
  existing.count++;
  if (existing.count > REGISTRATION_RATE_LIMIT_MAX) {
    throw new AgentAuthError("too_many_requests", "Too many requests for this agent registration.", 429);
  }
}

function isActiveRegistration(registration: AgentRegistration, now = new Date()): boolean {
  return registration.revokedAt === null && registration.expiresAt > now && registration.status !== "revoked";
}

function parseScopes(scopes: string[]): AgentScope[] {
  return agentScopeSchema.array().parse(scopes);
}

export class AgentAuthService {
  private readonly signingKey: Uint8Array;

  constructor(
    private readonly db: Database,
    private readonly config: AgentAuthConfig
  ) {
    this.signingKey = new TextEncoder().encode(config.signingSecret);
  }

  async createIdentity(input: AgentIdentityInput, metadata: AgentAuthRequestMetadata = {}): Promise<CreatedAgentIdentity> {
    assertEnabled(this.config);
    const parsed = agentIdentityInputSchema.parse(input);
    if (parsed.type === "service_auth") {
      checkEmailRateLimit(parsed.login_hint);
    }

    const now = new Date();
    const id = randomUUID();
    const claimToken = token(AGENT_CLAIM_TOKEN_PREFIX);
    const code = parsed.type === "service_auth" ? userCode() : undefined;
    const requestedScopes = normalizeAgentScopes({
      requestedScopes: parsed.scopes,
      allowedScopes: this.config.allowedScopes
    });
    const grantedScopes =
      parsed.type === "anonymous"
        ? normalizeAgentScopes({
            requestedScopes,
            allowedScopes: this.config.anonymousPreClaimScopes,
            defaultScopes: ["artifacts:read"]
          })
        : requestedScopes;
    const expiresAt = secondsFromNow(this.config.claimTtlSeconds, now);
    const assertionJti = parsed.type === "anonymous" ? randomUUID() : undefined;

    const [registration] = await this.db
      .insert(agentRegistrations)
      .values({
        id,
        type: parsed.type,
        status: "pending",
        loginHint: parsed.type === "service_auth" ? parsed.login_hint : null,
        requestedScopes,
        grantedScopes,
        claimTokenHash: hashAgentAuthSecret(claimToken),
        userCodeHash: code ? hashAgentAuthSecret(code) : null,
        assertionJtiHash: assertionJti ? hashAgentAuthSecret(assertionJti) : null,
        claimRequestedAt: code ? now : null,
        expiresAt,
        claimExpiresAt: expiresAt,
        metadata: {
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          unclaimed: true
        },
        createdAt: now,
        updatedAt: now
      })
      .returning();

    if (!registration) {
      throw new AgentAuthError("registration_failed", "Agent registration could not be created.", 500);
    }

    await this.recordRegistrationAudit("registration.created", registration, {
      requestedScopes,
      grantedScopes,
      unclaimed: true
    });

    const identityAssertion = assertionJti
      ? await this.signIdentityAssertion(registration, "pre_claim", grantedScopes, assertionJti)
      : undefined;

    return {
      type: registration.type,
      registration_id: registration.id,
      claim_token: claimToken,
      expires_in: this.config.claimTtlSeconds,
      verification_uri: verificationUri(this.config.appUrl),
      token_endpoint: endpoint(this.config.appUrl, "/oauth2/token"),
      revocation_endpoint: endpoint(this.config.appUrl, "/oauth2/revoke"),
      claim: code
        ? {
            user_code: code,
            verification_uri_complete: verificationUriComplete(this.config.appUrl, code)
          }
        : undefined,
      identity_assertion: identityAssertion,
      scope: scopeString(grantedScopes),
      unclaimed: true
    };
  }

  async requestAnonymousClaim(input: AgentIdentityClaimInput): Promise<ClaimedAgentIdentity> {
    assertEnabled(this.config);
    const parsed = agentIdentityClaimInputSchema.parse(input);
    checkEmailRateLimit(parsed.login_hint);

    const registration = await this.findRegistrationByClaimToken(parsed.claim_token);
    const now = new Date();
    if (!registration || registration.type !== "anonymous" || registration.status !== "pending" || !isActiveRegistration(registration, now)) {
      throw new AgentAuthError("invalid_claim_token", "Claim token is invalid or expired.", 400);
    }
    checkRegistrationRateLimit(registration.id);

    const code = userCode();
    const claimExpiresAt = secondsFromNow(this.config.claimTtlSeconds, now);
    const [updated] = await this.db
      .update(agentRegistrations)
      .set({
        loginHint: parsed.login_hint,
        userCodeHash: hashAgentAuthSecret(code),
        claimRequestedAt: now,
        claimExpiresAt,
        updatedAt: now
      })
      .where(
        and(
          eq(agentRegistrations.id, registration.id),
          eq(agentRegistrations.status, "pending"),
          isNull(agentRegistrations.revokedAt),
          gt(agentRegistrations.expiresAt, now)
        )
      )
      .returning();

    if (!updated) {
      throw new AgentAuthError("claim_request_failed", "Anonymous claim could not be started.", 500);
    }

    await this.recordRegistrationAudit("claim.requested", updated, {
      loginHint: parsed.login_hint,
      unclaimed: true
    });

    return {
      registration_id: updated.id,
      user_code: code,
      verification_uri: verificationUri(this.config.appUrl),
      verification_uri_complete: verificationUriComplete(this.config.appUrl, code),
      expires_in: this.config.claimTtlSeconds
    };
  }

  async completeClaim(input: AgentClaimCompleteInput, principal: Principal): Promise<CompletedAgentClaim> {
    assertEnabled(this.config);
    if (principal.type !== "user" || !principal.email) {
      throw new AgentAuthError("user_session_required", "A verified user session is required to claim this agent.", 403);
    }

    const parsed = agentClaimCompleteInputSchema.parse(input);
    checkEmailRateLimit(principal.email);
    const now = new Date();
    const [registration] = await this.db
      .select()
      .from(agentRegistrations)
      .where(
        and(
          eq(agentRegistrations.userCodeHash, hashAgentAuthSecret(parsed.user_code)),
          eq(agentRegistrations.status, "pending"),
          isNull(agentRegistrations.revokedAt),
          gt(agentRegistrations.claimExpiresAt, now)
        )
      )
      .limit(1);

    if (!registration || !isActiveRegistration(registration, now)) {
      throw new AgentAuthError("invalid_user_code", "User code is invalid or expired.", 400);
    }
    checkRegistrationRateLimit(registration.id);

    const loginHint = registration.loginHint?.toLowerCase();
    if (!loginHint || loginHint !== principal.email.toLowerCase()) {
      throw new AgentAuthError("login_hint_mismatch", "Sign in with the email address requested by this agent.", 403);
    }

    const [claimed] = await this.db
      .update(agentRegistrations)
      .set({
        status: "claimed",
        ownerUserId: principal.id,
        claimedAt: now,
        userCodeHash: null,
        grantedScopes: parseScopes(registration.requestedScopes),
        updatedAt: now
      })
      .where(
        and(
          eq(agentRegistrations.id, registration.id),
          eq(agentRegistrations.status, "pending"),
          eq(agentRegistrations.userCodeHash, hashAgentAuthSecret(parsed.user_code)),
          isNull(agentRegistrations.revokedAt),
          gt(agentRegistrations.claimExpiresAt, now)
        )
      )
      .returning();

    if (!claimed) {
      throw new AgentAuthError("claim_already_completed", "Agent claim is no longer pending.", 409);
    }

    const revokedPreClaimTokens = await this.revokePreClaimTokens(claimed.id, now);
    await this.recordRegistrationAudit("claim.confirmed", claimed, {
      actorUserId: principal.id,
      revokedPreClaimTokens
    });
    if (registration.type === "anonymous") {
      await this.recordRegistrationAudit("registration.upgraded", claimed, {
        from: "anonymous_pre_claim",
        revokedPreClaimTokens
      });
    }

    return {
      registration_id: claimed.id,
      owner_user_id: principal.id,
      revoked_pre_claim_tokens: revokedPreClaimTokens
    };
  }

  async exchangeClaimToken(claimToken: string): Promise<IssuedAgentAccessToken> {
    assertEnabled(this.config);
    const registration = await this.findRegistrationByClaimToken(claimToken);
    const now = new Date();
    if (!registration || !isActiveRegistration(registration, now)) {
      throw new AgentAuthError("invalid_grant", "Claim token is invalid or expired.", 400);
    }
    if (registration.status !== "claimed" || !registration.ownerUserId) {
      throw new AgentAuthError("authorization_pending", "Agent claim is not complete yet.", 428);
    }
    checkRegistrationRateLimit(registration.id);

    return this.issueAccessToken(registration, "post_claim", parseScopes(registration.grantedScopes), now);
  }

  async exchangeIdentityAssertion(assertion: string): Promise<IssuedAgentAccessToken> {
    assertEnabled(this.config);
    const payload = await this.verifyIdentityAssertion(assertion);
    const registrationId = typeof payload.registration_id === "string" ? payload.registration_id : undefined;
    const jti = typeof payload.jti === "string" ? payload.jti : undefined;
    if (!registrationId || !jti) {
      throw new AgentAuthError("invalid_grant", "Identity assertion is missing required claims.", 400);
    }

    const [registration] = await this.db
      .select()
      .from(agentRegistrations)
      .where(eq(agentRegistrations.id, registrationId))
      .limit(1);
    const now = new Date();
    if (
      !registration ||
      registration.type !== "anonymous" ||
      registration.status !== "pending" ||
      registration.ownerUserId !== null ||
      registration.assertionJtiHash !== hashAgentAuthSecret(jti) ||
      !isActiveRegistration(registration, now)
    ) {
      throw new AgentAuthError("invalid_grant", "Identity assertion is invalid or expired.", 400);
    }
    checkRegistrationRateLimit(registration.id);

    return this.issueAccessToken(registration, "pre_claim", parseScopes(registration.grantedScopes), now);
  }

  async revokeAccessToken(accessToken: string): Promise<void> {
    assertEnabled(this.config);
    if (!accessToken.startsWith(AGENT_ACCESS_TOKEN_PREFIX)) {
      return;
    }

    const now = new Date();
    const revoked = await this.db
      .update(agentAccessTokens)
      .set({ revokedAt: now })
      .where(and(eq(agentAccessTokens.tokenHash, hashAgentAuthSecret(accessToken)), isNull(agentAccessTokens.revokedAt)))
      .returning();

    for (const tokenRow of revoked) {
      await this.recordTokenAudit("token.revoked", tokenRow, {});
    }
  }

  async authenticateAccessToken(accessToken: string): Promise<Principal | undefined> {
    if (!this.config.enabled || !accessToken.startsWith(AGENT_ACCESS_TOKEN_PREFIX)) {
      return undefined;
    }

    const now = new Date();
    const [tokenRow] = await this.db
      .select()
      .from(agentAccessTokens)
      .where(
        and(
          eq(agentAccessTokens.tokenHash, hashAgentAuthSecret(accessToken)),
          isNull(agentAccessTokens.revokedAt),
          gt(agentAccessTokens.expiresAt, now)
        )
      )
      .limit(1);

    if (!tokenRow) {
      return undefined;
    }

    const [registration] = await this.db
      .select()
      .from(agentRegistrations)
      .where(eq(agentRegistrations.id, tokenRow.registrationId))
      .limit(1);

    if (!registration || registration.revokedAt || registration.status === "revoked") {
      return undefined;
    }

    await this.db.update(agentAccessTokens).set({ lastUsedAt: now }).where(eq(agentAccessTokens.id, tokenRow.id));

    return {
      type: "agent",
      id: tokenRow.registrationId,
      ownerUserId: tokenRow.ownerUserId ?? undefined,
      scopes: parseScopes(tokenRow.scopes)
    };
  }

  private async issueAccessToken(
    registration: AgentRegistration,
    tokenKind: AgentTokenKind,
    scopes: AgentScope[],
    now: Date
  ): Promise<IssuedAgentAccessToken> {
    const accessToken = token(AGENT_ACCESS_TOKEN_PREFIX);
    const ttl =
      tokenKind === "pre_claim" ? this.config.preClaimAccessTokenTtlSeconds : this.config.accessTokenTtlSeconds;
    const expiresAt = secondsFromNow(ttl, now);
    const id = randomUUID();

    const [created] = await this.db
      .insert(agentAccessTokens)
      .values({
        id,
        registrationId: registration.id,
        ownerUserId: tokenKind === "post_claim" ? registration.ownerUserId : null,
        tokenHash: hashAgentAuthSecret(accessToken),
        tokenKind,
        scopes,
        expiresAt,
        createdAt: now
      })
      .returning();

    if (!created) {
      throw new AgentAuthError("token_issue_failed", "Access token could not be issued.", 500);
    }

    await this.db.update(agentRegistrations).set({ lastIssuedAt: now, updatedAt: now }).where(eq(agentRegistrations.id, registration.id));
    await this.recordTokenAudit("token.issued", created, {
      tokenKind,
      scopes,
      unclaimed: tokenKind === "pre_claim"
    });

    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ttl,
      scope: scopeString(scopes),
      registration_id: registration.id,
      owner_user_id: created.ownerUserId ?? undefined,
      unclaimed: tokenKind === "pre_claim",
      identity_assertion: await this.signIdentityAssertion(
        { ...registration, ownerUserId: created.ownerUserId },
        tokenKind,
        scopes,
        randomUUID()
      )
    };
  }

  private async findRegistrationByClaimToken(claimToken: string): Promise<AgentRegistration | undefined> {
    const [registration] = await this.db
      .select()
      .from(agentRegistrations)
      .where(eq(agentRegistrations.claimTokenHash, hashAgentAuthSecret(claimToken)))
      .limit(1);
    return registration;
  }

  private async revokePreClaimTokens(registrationId: string, now: Date): Promise<number> {
    const revoked = await this.db
      .update(agentAccessTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(agentAccessTokens.registrationId, registrationId),
          eq(agentAccessTokens.tokenKind, "pre_claim"),
          isNull(agentAccessTokens.revokedAt)
        )
      )
      .returning();
    return revoked.length;
  }

  private async signIdentityAssertion(
    registration: AgentRegistration,
    tokenKind: AgentTokenKind,
    scopes: AgentScope[],
    jti: string
  ): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      registration_id: registration.id,
      registration_type: registration.type,
      token_kind: tokenKind,
      owner_user_id: registration.ownerUserId ?? undefined,
      unclaimed: tokenKind === "pre_claim",
      scope: scopeString(scopes)
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setSubject(`agent:${registration.id}`)
      .setJti(jti)
      .setIssuedAt(now)
      .setExpirationTime(now + this.config.identityAssertionTtlSeconds)
      .sign(this.signingKey);
  }

  private async verifyIdentityAssertion(assertion: string): Promise<Record<string, unknown>> {
    try {
      const { payload } = await jwtVerify(assertion, this.signingKey, {
        issuer: this.config.issuer,
        audience: this.config.audience
      });
      return payload as Record<string, unknown>;
    } catch {
      throw new AgentAuthError("invalid_grant", "Identity assertion is invalid or expired.", 400);
    }
  }

  private async recordRegistrationAudit(action: string, registration: AgentRegistration, metadata: Record<string, unknown>) {
    await this.db.insert(auditEvents).values({
      id: randomUUID(),
      ownerUserId: registration.ownerUserId ?? registration.loginHint ?? "unclaimed-agent",
      actorPrincipalType: registration.ownerUserId ? "user" : "agent",
      actorPrincipalId: registration.ownerUserId ?? registration.id,
      action,
      targetType: "agent_registration",
      targetId: registration.id,
      metadata
    });
  }

  private async recordTokenAudit(action: string, tokenRow: AgentAccessToken, metadata: Record<string, unknown>) {
    const [registration] = await this.db
      .select({
        id: agentRegistrations.id,
        loginHint: agentRegistrations.loginHint,
        ownerUserId: agentRegistrations.ownerUserId
      })
      .from(agentRegistrations)
      .where(eq(agentRegistrations.id, tokenRow.registrationId))
      .limit(1);

    await this.db.insert(auditEvents).values({
      id: randomUUID(),
      ownerUserId: tokenRow.ownerUserId ?? registration?.ownerUserId ?? registration?.loginHint ?? "unclaimed-agent",
      actorPrincipalType: "agent",
      actorPrincipalId: tokenRow.registrationId,
      action,
      targetType: "agent_access_token",
      targetId: tokenRow.id,
      metadata
    });
  }

  async lookupUserById(userId: string): Promise<{ id: string; email: string } | undefined> {
    const [user] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }
}
