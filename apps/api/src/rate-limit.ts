import type { Context, MiddlewareHandler } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "@agent-artifacts/db";
import { logger } from "./logger.js";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyFn?: (c: Context) => string;
  store?: RateLimitStore | (() => RateLimitStore);
}

interface WindowState {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number, now: number): Promise<WindowState>;
}

class MemoryRateLimitStore implements RateLimitStore {
  private readonly store = new Map<string, WindowState>();

  private cleanupTimer: ReturnType<typeof setInterval> | undefined;

  increment(key: string, windowMs: number, now: number): Promise<WindowState> {
    this.startCleanup(windowMs);

    const existing = this.store.get(key);
    if (!existing || existing.resetAt <= now) {
      const created = { count: 1, resetAt: now + windowMs };
      this.store.set(key, created);
      return Promise.resolve(created);
    }

    existing.count++;
    return Promise.resolve(existing);
  }

  private startCleanup(windowMs: number): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, state] of this.store) {
        if (state.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, windowMs);
    this.cleanupTimer.unref();
  }
}

export class DatabaseRateLimitStore implements RateLimitStore {
  constructor(private readonly db: Pick<Database, "execute">) {}

  async increment(key: string, windowMs: number, now: number): Promise<WindowState> {
    const resetAt = new Date(now + windowMs);
    const result = await this.db.execute(sql`
      INSERT INTO api_rate_limits ("key", "count", "reset_at", "updated_at")
      VALUES (${key}, 1, ${resetAt}, now())
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN api_rate_limits."reset_at" <= now() THEN 1
          ELSE api_rate_limits."count" + 1
        END,
        "reset_at" = CASE
          WHEN api_rate_limits."reset_at" <= now() THEN ${resetAt}
          ELSE api_rate_limits."reset_at"
        END,
        "updated_at" = now()
      RETURNING "count", "reset_at";
    `);
    const row = firstRow(result);
    if (!row) {
      throw new Error("Rate limit counter update did not return a row.");
    }

    return {
      count: Number(row.count),
      resetAt: toTimestamp(row.reset_at)
    };
  }
}

export function createMemoryRateLimitStore(): RateLimitStore {
  return new MemoryRateLimitStore();
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { windowMs, max, keyFn } = options;
  const defaultStore = createMemoryRateLimitStore();

  return async (c, next) => {
    const key = keyFn ? keyFn(c) : clientIp(c);
    const now = Date.now();
    const store = typeof options.store === "function" ? options.store() : (options.store ?? defaultStore);
    const state = await store.increment(key, windowMs, now);
    const remaining = Math.max(0, max - state.count);
    c.header("x-ratelimit-limit", String(max));
    c.header("x-ratelimit-remaining", String(remaining));
    c.header("x-ratelimit-reset", String(Math.ceil(state.resetAt / 1000)));

    if (state.count > max) {
      logger.warn("rate_limited", {
        key,
        path: c.req.path,
        count: state.count,
        limit: max
      });
      return c.json({ error: "too_many_requests", message: "Rate limit exceeded." }, 429);
    }

    return next();
  };
}

function firstRow(result: unknown): { count: unknown; reset_at: unknown } | undefined {
  if (Array.isArray(result)) {
    return result[0] as { count: unknown; reset_at: unknown } | undefined;
  }

  if (result && typeof result === "object" && "rows" in result && Array.isArray(result.rows)) {
    return result.rows[0] as { count: unknown; reset_at: unknown } | undefined;
  }

  return undefined;
}

function toTimestamp(value: unknown): number {
  if (value instanceof Date || typeof value === "string" || typeof value === "number") {
    return new Date(value).getTime();
  }

  throw new Error("Rate limit counter returned an invalid reset timestamp.");
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
