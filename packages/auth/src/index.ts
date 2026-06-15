import {
  accounts,
  oauthAccessTokens,
  oauthApplications,
  oauthConsents,
  sessions,
  users,
  verifications
} from "@agent-artifacts/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, mcp, withMcpAuth } from "better-auth/plugins";
import type { Principal } from "@agent-artifacts/shared";

export { withMcpAuth };
export {
  AGENT_ACCESS_TOKEN_PREFIX,
  AGENT_AUTH_CLAIM_GRANT,
  AGENT_CLAIM_TOKEN_PREFIX,
  AgentAuthError,
  AgentAuthService,
  JWT_BEARER_GRANT,
  agentClaimCompleteInputSchema,
  agentIdentityClaimInputSchema,
  agentIdentityInputSchema,
  hashAgentAuthSecret,
  normalizeAgentScopes,
  type AgentAuthConfig,
  type AgentAuthRequestMetadata,
  type AgentClaimCompleteInput,
  type AgentIdentityClaimInput,
  type AgentIdentityInput,
  type ClaimedAgentIdentity,
  type CompletedAgentClaim,
  type CreatedAgentIdentity,
  type IssuedAgentAccessToken
} from "./agent-auth-service.js";
export {
  API_KEY_PREFIX,
  ApiKeyNotFoundError,
  ApiKeyService,
  createApiKeyInputSchema,
  type ApiKeySummary,
  type CreatedApiKey,
  type CreateApiKeyInput
} from "./api-key-service.js";

export interface BetterAuthHandle {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (
      input: {
        headers: Headers;
      }
    ) => Promise<{
      session?: unknown;
      user?: {
        id: string;
        email: string;
        emailVerified?: boolean;
      };
    } | null>;
  };
}

export interface AuthConfig {
  database: unknown;
  secret: string;
  /** Canonical URL that browsers use for OAuth redirects (often same as the web app origin). */
  baseUrl: string;
  /** Extra origins allowed for auth flows (API origin during development, preview URLs, etc.). */
  trustedOrigins?: string[];
  /** Where humans land for interactive login (MCP plugin); defaults to `baseUrl`. */
  webOrigin?: string;
  googleClientId: string;
  googleClientSecret: string;
}

export function createAuth(config: AuthConfig): BetterAuthHandle {
  const webOrigin = config.webOrigin ?? config.baseUrl;
  const trustedOrigins = [...new Set([config.baseUrl, webOrigin, ...(config.trustedOrigins ?? [])])];

  return betterAuth({
    database: drizzleAdapter(config.database as never, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        oauthApplication: oauthApplications,
        oauthAccessToken: oauthAccessTokens,
        oauthConsent: oauthConsents
      }
    }),
    secret: config.secret,
    baseURL: config.baseUrl,
    trustedOrigins,
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret
      }
    },
    plugins: [
      bearer(),
      mcp({
        loginPage: `${webOrigin.replace(/\/+$/, "")}/login`
      })
    ]
  }) as BetterAuthHandle;
}

export function createUserPrincipal(input: { userId: string; email: string; emailVerified?: boolean }): Principal {
  return {
    type: "user",
    id: input.userId,
    ownerUserId: input.userId,
    email: input.emailVerified ? input.email : undefined,
    scopes: []
  };
}

