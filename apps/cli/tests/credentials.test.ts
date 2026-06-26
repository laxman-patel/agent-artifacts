import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearStoredCredentials, credentialsPath, loadStoredCredentials, saveStoredCredentials } from "../src/auth/credentials.js";

describe("credentials store", () => {
  let configDir: string;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "agent-artifacts-credentials-"));
    process.env.AGENT_ARTIFACTS_CONFIG_DIR = configDir;
  });

  afterEach(() => {
    clearStoredCredentials();
    rmSync(configDir, { recursive: true, force: true });
    delete process.env.AGENT_ARTIFACTS_CONFIG_DIR;
  });

  it("round-trips saved credentials", () => {
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

  it("persists the token without relying on an OS keyring", () => {
    saveStoredCredentials({
      baseUrl: "https://api.artifacts.example.com",
      webUrl: "https://artifacts.example.com",
      token: "sensitive-token",
      apiKeyId: "key_123",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });

    const stored = JSON.parse(readFileSync(credentialsPath(), "utf8")) as Record<string, unknown>;
    expect(stored.token).toBe("sensitive-token");
    expect(stored.apiKeyId).toBe("key_123");
    expect(loadStoredCredentials()?.token).toBe("sensitive-token");
  });

  it("writes the credentials file with 0600 permissions", () => {
    saveStoredCredentials({
      baseUrl: "https://api.artifacts.example.com",
      webUrl: "https://artifacts.example.com",
      token: "sensitive-token",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });

    const mode = statSync(credentialsPath()).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("ignores a corrupt credentials file instead of throwing", () => {
    saveStoredCredentials({
      baseUrl: "https://api.artifacts.example.com",
      webUrl: "https://artifacts.example.com",
      token: "sensitive-token",
      updatedAt: "2026-05-22T00:00:00.000Z"
    });
    rmSync(credentialsPath(), { force: true });
    expect(loadStoredCredentials()).toBeNull();
  });
});
