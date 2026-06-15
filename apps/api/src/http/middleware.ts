import { bodyLimit } from "hono/body-limit";
import type { Hono, MiddlewareHandler } from "hono";
import { MAX_ARTIFACT_CONTENT_BYTES } from "@agent-artifacts/artifact";
import { AGENT_ACCESS_TOKEN_PREFIX, API_KEY_PREFIX } from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { csrfOriginGuard } from "../csrf.js";
import { getAgentAuthService, getApiKeyService } from "../deps.js";
import { rateLimit } from "../rate-limit.js";
import type { AppVariables } from "../deps.js";

export const writeLimiter = rateLimit({ windowMs: 60_000, max: 60 });
export const readLimiter = rateLimit({ windowMs: 60_000, max: 300 });

const HTTP_BODY_LIMIT_BYTES = MAX_ARTIFACT_CONTENT_BYTES + 64 * 1024;

export const artifactBodyLimit = bodyLimit({
  maxSize: HTTP_BODY_LIMIT_BYTES,
  onError: (c) => c.json({ error: "payload_too_large", message: `Body exceeds ${HTTP_BODY_LIMIT_BYTES} byte limit.` }, 413)
});

export const webhookBodyLimit = bodyLimit({
  maxSize: 256 * 1024,
  onError: (c) => c.json({ error: "payload_too_large", message: "Webhook body exceeds 262144 byte limit." }, 413)
});

export const csrfGuard: MiddlewareHandler = async (c, next) => {
  const env = loadServerEnv();
  return csrfOriginGuard([env.PUBLIC_APP_URL, env.BETTER_AUTH_URL], async (requestContext) => {
    const authorization = requestContext.req.header("authorization");
    if (!authorization || !/^bearer\s+\S+/i.test(authorization)) {
      return false;
    }

    const token = authorization.match(/^bearer\s+(\S+)$/i)?.[1];
    if (token?.startsWith(API_KEY_PREFIX)) {
      return Boolean(await getApiKeyService().authenticateToken(token));
    }
    if (token?.startsWith(AGENT_ACCESS_TOKEN_PREFIX)) {
      return Boolean(await getAgentAuthService().authenticateAccessToken(token));
    }

    return false;
  })(c, next);
};

export const CSRF_PROTECTED_ROUTES = [
  { path: "/api/artifacts", middleware: [writeLimiter, artifactBodyLimit, csrfGuard] as const },
  { path: "/api/artifacts/:artifactId", middleware: [csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/versions", middleware: [writeLimiter, artifactBodyLimit, csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/versions/:versionNumber/restore", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/access", middleware: [csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/share-links", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/share-links/:shareLinkId/revoke", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/projects", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspaces", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspaces/:workspaceId/projects", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspaces/:workspaceId/artifacts", middleware: [writeLimiter, artifactBodyLimit, csrfGuard] as const },
  { path: "/api/workspaces/:workspaceId/invitations", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspaces/:workspaceId/members/:userId", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspace-invitations/accept", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspace-invitations/:invitationId/revoke", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/workspace-invitations/:invitationId/resend", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/billing/checkout", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/billing/portal", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/billing/storage-snapshot", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/api-keys", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/api-keys/:apiKeyId", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/agent/identity/claim/complete", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/profile/username", middleware: [csrfGuard] as const },
  { path: "/api/cli/authorize", middleware: [csrfGuard] as const }
] as const;

export function registerMiddleware(app: Hono<{ Variables: AppVariables }>) {
  for (const route of CSRF_PROTECTED_ROUTES) {
    app.use(route.path, ...route.middleware);
  }

  app.use("/api/artifacts/*", readLimiter);
  app.use("/agent/identity", writeLimiter);
  app.use("/agent/identity/claim", writeLimiter);
  app.use("/oauth2/token", writeLimiter);
  app.use("/oauth2/revoke", writeLimiter);
  app.use("/mcp", writeLimiter, artifactBodyLimit);
  app.use("/api/webhooks/dodo", writeLimiter, webhookBodyLimit);
  app.use("/api/internal/billing/storage-snapshots", writeLimiter);
}
