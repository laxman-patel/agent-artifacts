import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";

const originalEnv = { ...process.env };

function setRequiredEnv(overrides: Record<string, string> = {}) {
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
  for (const [key, value] of Object.entries(overrides)) {
    process.env[key] = value;
  }
}

describe("auth.md discovery", () => {
  beforeEach(() => {
    setRequiredEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("advertises agent_auth metadata without enabling flows by default", async () => {
    const response = await app.request("/.well-known/oauth-protected-resource");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      agent_auth: {
        enabled: false,
        supported_flows: [],
        registration_endpoint: "http://localhost:3000/agent/identity",
        token_endpoint: "http://localhost:3000/oauth2/token"
      }
    });
  });

  it("advertises supported auth.md flows when enabled", async () => {
    setRequiredEnv({ AUTH_MD_ENABLED: "true" });
    const response = await app.request("/.well-known/oauth-protected-resource");

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      scopes_supported: string[];
      agent_auth: { supported_flows: string[]; anonymous_pre_claim_scopes: string[] };
    };

    expect(payload.scopes_supported).toContain("artifacts:read");
    expect(payload.agent_auth.supported_flows).toEqual(["service_auth", "anonymous"]);
    expect(payload.agent_auth.anonymous_pre_claim_scopes).toEqual(["artifacts:read"]);
  });
});
