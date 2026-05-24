import type { Context, MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (c: Context) => string;
}

interface WindowState {
  count: number;
  resetAt: number;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, keyFn } = options;
  const store = new Map<string, WindowState>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, state] of store) {
      if (state.resetAt <= now) {
        store.delete(key);
      }
    }
  }, windowMs).unref();

  return async (c, next) => {
    const key = keyFn ? keyFn(c) : clientIp(c);
    const now = Date.now();
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      c.header("x-ratelimit-limit", String(max));
      c.header("x-ratelimit-remaining", String(max - 1));
      return next();
    }

    existing.count++;
    const remaining = Math.max(0, max - existing.count);
    c.header("x-ratelimit-limit", String(max));
    c.header("x-ratelimit-remaining", String(remaining));
    c.header("x-ratelimit-reset", String(Math.ceil(existing.resetAt / 1000)));

    if (existing.count > max) {
      return c.json({ error: "too_many_requests", message: "Rate limit exceeded." }, 429);
    }

    return next();
  };
}

function clientIp(c: Context): string {
  if (process.env.TRUST_PROXY !== "true") {
    return "direct";
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

  return "unknown";
}
