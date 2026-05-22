import { describe, expect, it } from "vitest";
import { clearStoredCredentials, credentialsPath, loadStoredCredentials, saveStoredCredentials } from "../src/auth/credentials.js";

describe("credentials store", () => {
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
});
