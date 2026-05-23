import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";
import type { AppVariables } from "./deps.js";
import { registerMiddleware } from "./http/middleware.js";
import { registerRoutes } from "./routes/index.js";

export const app = new Hono<{ Variables: AppVariables }>();

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

  logger.info("request", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: duration
  });
});

registerMiddleware(app);
registerRoutes(app);
