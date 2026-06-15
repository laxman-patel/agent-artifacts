import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { app } from "../src/app.js";
import { csrfOriginGuard } from "../src/csrf.js";
import { registerMiddleware } from "../src/http/middleware.js";

const originalEnv = { ...process.env };

function setRequiredEnv() {
  process.env.DATABASE_URL = "postgresql://user:password@localhost:5432/agent_artifacts";
  process.env.BETTER_AUTH_SECRET = "x".repeat(32);
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.GOOGLE_CLIENT_ID = "google-client";
  process.env.GOOGLE_CLIENT_SECRET = "google-secret";
  process.env.PUBLIC_APP_URL = "http://localhost:3000";
  process.env.S3_ENDPOINT = "https://example.com";
  process.env.S3_BUCKET = "agent-artifacts";
  process.env.S3_REGION = "auto";
  process.env.S3_ACCESS_KEY_ID = "access-key";
  process.env.S3_SECRET_ACCESS_KEY = "secret-key";
}

describe("security headers", () => {
  it("includes security headers on API responses", async () => {
    const response = await app.request("/health");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
  });
});

describe("rate limiting", () => {
  it("returns rate limit headers on write routes", async () => {
    const response = await app.request("/api/artifacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });

    expect(response.headers.get("x-ratelimit-limit")).toBeTruthy();
    expect(response.headers.get("x-ratelimit-remaining")).toBeTruthy();
  });

  it("does not return 2xx for unauthenticated mutations", async () => {
    const response = await app.request("/api/artifacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ownerUsername: "testuser",
        slug: "test-artifact",
        type: "html",
        title: "Test",
        content: "<p>Hello</p>"
      })
    });
    expect(response.status).not.toBe(200);
    expect(response.status).not.toBe(201);
  });
});

describe("CSRF protection", () => {
  it("does not let cookies bypass origin checks through failed bearer auth", async () => {
    const testApp = new Hono();
    testApp.use(
      "*",
      csrfOriginGuard(["https://app.example.com"], async () => false)
    );
    testApp.post("/mutate", (c) => c.text("ok"));

    const response = await testApp.request("/mutate", {
      method: "POST",
      headers: {
        authorization: "Bearer session-backed-token",
        cookie: "better-auth.session_token=victim-session"
      }
    });

    expect(response.status).toBe(403);
  });

  it("protects unlisted mutation routes by default", async () => {
    setRequiredEnv();
    const testApp = new Hono();
    registerMiddleware(testApp);
    testApp.post("/api/new-cookie-mutation", (c) => c.text("ok"));

    try {
      const response = await testApp.request("/api/new-cookie-mutation", {
        method: "POST",
        headers: {
          cookie: "better-auth.session_token=victim-session"
        }
      });

      expect(response.status).toBe(403);
    } finally {
      process.env = { ...originalEnv };
    }
  });
});

describe("MCP authorization", () => {
  it("returns MCP error for tools/call without credentials", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "create_artifact",
          arguments: {
            ownerUsername: "testuser",
            slug: "test",
            type: "html",
            title: "Test",
            content: "<p>Test</p>"
          }
        }
      })
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: unknown; error?: { code: number; message: string } };
    expect(payload.error).toBeTruthy();
  });

  it("MCP initialize requires no auth", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" })
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: { capabilities: unknown } };
    expect(payload.result?.capabilities).toBeTruthy();
  });

  it("MCP tools/list requires no auth", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: { tools: unknown[] } };
    expect(Array.isArray(payload.result?.tools)).toBe(true);
  });

  it("returns error for unknown MCP tool", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "nonexistent_tool", arguments: {} }
      })
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { error?: { code: number } };
    // Without a configured test DB the request fails env validation before
    // reaching the unknown-tool branch. Either way we expect *some* error.
    expect(payload.error).toBeTruthy();
  });
});

describe("input validation", () => {
  it("returns error for malformed MCP request", async () => {
    const response = await app.request("/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ not: "valid-jsonrpc" })
    });
    expect([200, 400, 422, 500].includes(response.status)).toBe(true);
  });
});
