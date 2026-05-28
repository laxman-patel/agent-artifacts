import { bodyLimit } from "hono/body-limit";
import type { Hono, MiddlewareHandler } from "hono";
import { MAX_ARTIFACT_CONTENT_BYTES } from "@agent-artifacts/artifact";
import { loadServerEnv } from "@agent-artifacts/config";
import { csrfOriginGuard } from "../csrf.js";
import { getAuth } from "../deps.js";
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

let csrfGuardImpl: MiddlewareHandler | undefined;

export const csrfGuard: MiddlewareHandler = async (c, next) => {
  csrfGuardImpl ??= csrfOriginGuard(
    [loadServerEnv().PUBLIC_APP_URL, loadServerEnv().BETTER_AUTH_URL],
    async (requestContext) => {
      const authorization = requestContext.req.header("authorization");
      if (!authorization || !/^bearer\s+\S+/i.test(authorization)) {
        return false;
      }

      const session = await getAuth().api.getSession({ headers: requestContext.req.raw.headers });
      return Boolean(session?.user);
    }
  );
  return csrfGuardImpl(c, next);
};

const CSRF_PROTECTED_ROUTES = [
  { path: "/api/artifacts", middleware: [writeLimiter, artifactBodyLimit, csrfGuard] as const },
  { path: "/api/artifacts/:artifactId", middleware: [csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/versions", middleware: [writeLimiter, artifactBodyLimit, csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/access", middleware: [csrfGuard] as const },
  { path: "/api/artifacts/:artifactId/share-links", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/share-links/:shareLinkId/revoke", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/projects", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/billing/checkout", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/billing/portal", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/billing/storage-snapshot", middleware: [writeLimiter, csrfGuard] as const },
  { path: "/api/profile/username", middleware: [csrfGuard] as const },
  { path: "/api/cli/authorize", middleware: [csrfGuard] as const }
] as const;

export function registerMiddleware(app: Hono<{ Variables: AppVariables }>) {
  for (const route of CSRF_PROTECTED_ROUTES) {
    app.use(route.path, ...route.middleware);
  }

  app.use("/api/artifacts/*", readLimiter);
  app.use("/mcp", writeLimiter, artifactBodyLimit);
  app.use("/api/webhooks/dodo", writeLimiter, webhookBodyLimit);
  app.use("/api/internal/billing/storage-snapshots", writeLimiter);
}
