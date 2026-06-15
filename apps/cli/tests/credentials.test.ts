import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearStoredCredentials, credentialsPath, loadStoredCredentials, saveStoredCredentials } from "../src/auth/credentials.js";

describe("credentials store", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "agent-artifacts-credentials-"));
    process.env.AGENT_ARTIFACTS_CONFIG_DIR = configDir;
    process.env.AGENT_ARTIFACTS_INSECURE_TEST_CREDENTIAL_STORE = "file";
  });

  afterEach(() => {
    clearStoredCredentials();
    rmSync(configDir, { recursive: true, force: true });
    delete process.env.AGENT_ARTIFACTS_CONFIG_DIR;
    delete process.env.AGENT_ARTIFACTS_INSECURE_TEST_CREDENTIAL_STORE;
  });

  it("loads saved credentials", () => {
    saveStoredCredentials({
      baseUrl: "http://127.0.0.1:3001",
      webUrl: "http://localhost:3000",
      token: "test-token",
      email: "user@example.com",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });

    expect(loadStoredCredentials()).toEqual({
      baseUrl: "http://127.0.0.1:3001",
      webUrl: "http://localhost:3000",
      token: "test-token",
      email: "user@example.com",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });
    expect(credentialsPath()).toContain("agent-artifacts");
    clearStoredCredentials();
    expect(loadStoredCredentials()).toBeNull();
  });

  it("keeps tokens out of the metadata file", () => {
    saveStoredCredentials({
      baseUrl: "https://api.artifacts.example.com",
      webUrl: "https://artifacts.example.com",
      token: "sensitive-token",
      apiKeyId: "key_123",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });

    const metadata = JSON.parse(readFileSync(credentialsPath(), "utf8")) as Record<string, unknown>;
    expect(metadata.token).toBeUndefined();
    expect(metadata.store).toBe("test-file");
    expect(loadStoredCredentials()?.token).toBe("sensitive-token");
  });
});
