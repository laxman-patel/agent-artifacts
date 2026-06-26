import type { Hono } from "hono";
import { AGENT_AUTH_CLAIM_GRANT, JWT_BEARER_GRANT } from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { buildWorkspaceProjectArtifactUrl } from "@agent-artifacts/shared";
import { getAuth } from "../deps.js";
import { handleMcp } from "../http/handler.js";
import { handleMcpRequest } from "../http/mcp.js";
import { registerArtifactRoutes } from "./artifacts.js";
import { registerAgentAuthRoutes } from "./agent-auth.js";
import { registerApiKeyRoutes } from "./api-keys.js";
import { registerBillingRoutes } from "./billing.js";
import { registerCliRoutes } from "./cli.js";
import { registerProfileRoutes } from "./profile.js";
import { registerProjectRoutes } from "./projects.js";
import { registerShareLinkRoutes } from "./share-links.js";
import { registerWorkspaceInvitationRoutes } from "./workspace-invitations.js";
import { registerWorkspaceRoutes } from "./workspaces.js";
import type { AppVariables } from "../deps.js";

function baseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function configuredAgentScopes(): string[] {
  return loadServerEnv().AUTH_MD_ALLOWED_SCOPES
    .split(",")
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function stringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  return value.filter((item): item is string => typeof item === "string");
}

function agentAuthMetadata() {
  const env = loadServerEnv();
  const appUrl = baseUrl(env.PUBLIC_APP_URL);
  return {
    enabled: env.AUTH_MD_ENABLED,
    auth_md: `${appUrl}/auth.md`,
    registration_endpoint: `${appUrl}/agent/identity`,
    claim_endpoint: `${appUrl}/agent/identity/claim`,
    claim_completion_endpoint: `${appUrl}/api/agent/identity/claim/complete`,
    token_endpoint: `${appUrl}/oauth2/token`,
    revocation_endpoint: `${appUrl}/oauth2/revoke`,
    supported_flows: env.AUTH_MD_ENABLED ? ["service_auth", "anonymous"] : [],
    anonymous_pre_claim_scopes: env.AUTH_MD_ANONYMOUS_PRE_CLAIM_SCOPES.split(",")
      .map((scope) => scope.trim())
      .filter((scope) => scope.length > 0),
    claim_token_grant_type: AGENT_AUTH_CLAIM_GRANT,
    jwt_bearer_grant_type: JWT_BEARER_GRANT
  };
}

export function registerRoutes(app: Hono<{ Variables: AppVariables }>) {
  // `/health` is for internal/platform probes hitting the API directly.
  // `/api/health` is the public-facing equivalent: deployments proxy only
  // `/api/*` to this service, so this is the path the CLI and external clients
  // can actually reach in production.
  const healthBody = { ok: true, service: "agent-artifacts-api" } as const;
  app.get("/health", (c) => c.json(healthBody));
  app.get("/api/health", (c) => c.json(healthBody));

  app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));

  registerCliRoutes(app);
  registerAgentAuthRoutes(app);

  app.post("/mcp", (c) => handleMcp(c, () => handleMcpRequest(c)));

  app.get("/.well-known/oauth-protected-resource", (c) =>
    c.json({
      resource: loadServerEnv().PUBLIC_APP_URL,
      authorization_servers: [loadServerEnv().BETTER_AUTH_URL],
      scopes_supported: unique(["openid", "profile", "email", ...configuredAgentScopes()]),
      bearer_methods_supported: ["header"],
      agent_auth: agentAuthMetadata()
    })
  );

  app.get("/.well-known/oauth-authorization-server", async (c) => {
    const url = new URL(c.req.raw.url);
    url.pathname = "/api/auth/.well-known/oauth-authorization-server";
    const response = await getAuth().handler(new Request(url.toString(), c.req.raw));
    const body = await response.json().catch(() => ({}));
    const metadata: Record<string, unknown> = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
    const appUrl = baseUrl(loadServerEnv().PUBLIC_APP_URL);

    return Response.json(
      {
        ...metadata,
        token_endpoint: `${appUrl}/oauth2/token`,
        revocation_endpoint: `${appUrl}/oauth2/revoke`,
        grant_types_supported: unique([
          ...stringArray(metadata.grant_types_supported),
          AGENT_AUTH_CLAIM_GRANT,
          JWT_BEARER_GRANT
        ]),
        scopes_supported: unique([
          ...stringArray(metadata.scopes_supported, ["openid", "profile", "email"]),
          ...configuredAgentScopes()
        ]),
        agent_auth: agentAuthMetadata()
      },
      {
        status: response.status,
        headers: {
          "cache-control": response.headers.get("cache-control") ?? "no-store"
        }
      }
    );
  });

  registerWorkspaceRoutes(app);
  registerWorkspaceInvitationRoutes(app);
  registerProjectRoutes(app);
  registerProfileRoutes(app);
  registerApiKeyRoutes(app);
  registerBillingRoutes(app);
  registerArtifactRoutes(app);
  registerShareLinkRoutes(app);

  app.get("/api/slug-preview/:username/:projectSlug/:slug", (c) => {
    const username = c.req.param("username");
    const projectSlug = c.req.param("projectSlug");
    const slug = c.req.param("slug");
    const appUrl = loadServerEnv().PUBLIC_APP_URL;

    return c.json({
      url: buildWorkspaceProjectArtifactUrl(appUrl, username, projectSlug, slug)
    });
  });
}
