import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";
import type { AppVariables } from "./deps.js";
import { resolvePrincipal } from "./http/principal.js";
import { registerMiddleware } from "./http/middleware.js";
import { registerRoutes } from "./routes/index.js";

export const app = new Hono<{ Variables: AppVariables }>();

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string | undefined {
  if (process.env.TRUST_PROXY !== "true") {
    return undefined;
  }

  const cfConnectingIp = c.req.header("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) {
    return forwardedFor;
  }

  return undefined;
}

app.use("*", async (c, next) => {
  const requestId = randomUUID();
  const start = Date.now();
  c.set("requestId", requestId);
  c.header("x-request-id", requestId);

  await next();

  const duration = Date.now() - start;
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("referrer-policy", "strict-origin-when-cross-origin");

  const status = c.res.status;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  let principal = c.get("principal");
  if (!principal) {
    try {
      principal = await resolvePrincipal(c);
      c.set("principal", principal);
    } catch {
      // Best-effort attribution for request logs only.
    }
  }

  const ip = clientIp(c);
  const userAgent = c.req.header("user-agent");

  logger[level]("request", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status,
    durationMs: duration,
    userId: principal?.type === "user" ? principal.id : undefined,
    principalType: principal?.type,
    userAgent,
    ip
  });
});

registerMiddleware(app);
registerRoutes(app);
