import { createHash, randomBytes } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, mcp } from "better-auth/plugins";
import type { AgentScope, Principal } from "@agent-artifacts/shared";
import { agentScopeSchema } from "@agent-artifacts/shared";

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
      provider: "pg"
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

export function createUserPrincipal(input: { userId: string; email: string }): Principal {
  return {
    type: "user",
    id: input.userId,
    ownerUserId: input.userId,
    email: input.email,
    scopes: []
  };
}

export function createAgentPrincipal(input: {
  agentId: string;
  ownerUserId: string;
  scopes: AgentScope[];
}): Principal {
  return {
    type: "agent",
    id: input.agentId,
    ownerUserId: input.ownerUserId,
    scopes: input.scopes
  };
}

export function createApiKeyPrincipal(input: { apiKeyId: string; ownerUserId: string; scopes: string[] }): Principal {
  return {
    type: "api_key",
    id: input.apiKeyId,
    ownerUserId: input.ownerUserId,
    scopes: input.scopes.map((scope) => agentScopeSchema.parse(scope))
  };
}

export function generateApiKeySecret(): string {
  return `aa_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}
