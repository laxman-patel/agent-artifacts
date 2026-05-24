import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rateLimit } from "../src/rate-limit.js";

describe("rate limit client IP keying", () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  beforeEach(() => {
    delete process.env.TRUST_PROXY;
  });

  afterEach(() => {
    if (originalTrustProxy === undefined) {
      delete process.env.TRUST_PROXY;
    } else {
      process.env.TRUST_PROXY = originalTrustProxy;
    }
  });

  it("ignores proxy IP headers when TRUST_PROXY is unset", async () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 2 });
    const app = new Hono();
    app.use("*", limiter);
    app.get("/", (c) => c.text("ok"));

    const request = (xRealIp: string) =>
      app.request("/", { headers: { "x-real-ip": xRealIp } });

    const first = await request("1.2.3.4");
    expect(first.status).toBe(200);
    expect(first.headers.get("x-ratelimit-remaining")).toBe("1");

    const second = await request("5.6.7.8");
    expect(second.status).toBe(200);
    expect(second.headers.get("x-ratelimit-remaining")).toBe("0");

    const third = await request("9.10.11.12");
    expect(third.status).toBe(429);
  });
});
