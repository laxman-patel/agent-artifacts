import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, mcp } from "better-auth/plugins";
import type { AgentScope, Principal } from "@agent-artifacts/shared";

export interface AuthConfig {
  database: unknown;
  secret: string;
  baseUrl: string;
  googleClientId: string;
  googleClientSecret: string;
}

export interface AuthInstance {
  handler(request: Request): Promise<Response>;
}

export function createAuth(config: AuthConfig): AuthInstance {
  return betterAuth({
    database: drizzleAdapter(config.database as never, {
      provider: "pg"
    }),
    secret: config.secret,
    baseURL: config.baseUrl,
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret
      }
    },
    plugins: [
      bearer(),
      mcp({
        loginPage: `${config.baseUrl.replace(/\/+$/, "")}/login`
      })
    ]
  });
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
