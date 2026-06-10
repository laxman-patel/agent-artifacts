import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/client.js";
import { CliError } from "../src/errors.js";
import { runCli } from "../src/program.js";

vi.mock("../src/auth/credentials.js", () => ({
  loadStoredCredentials: () => null,
  credentialsPath: () => "/tmp/agent-artifacts-test-credentials.json",
  saveStoredCredentials: vi.fn(),
  clearStoredCredentials: vi.fn()
}));

describe("CLI auth guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fails mutating HTTP commands before calling the API when no credentials are present", async () => {
    await expect(
      runCli([
        "node",
        "artifacts",
        "artifact",
        "update",
        "--artifact-id",
        "artifact_123",
        "--json",
        '{"content":"# Updated"}'
      ])
    ).rejects.toMatchObject({
      kind: "auth",
      message: "Not signed in. Run `artifacts login`."
    });
  });

  it("maps csrf_blocked API responses to a sign-in hint", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(
      () => Promise.resolve(Response.json({ error: "csrf_blocked" }, { status: 403 }))
    ));
    const client = new ApiClient({
      baseUrl: "https://api.example.com",
      webUrl: "https://app.example.com",
      token: "session-token",
      format: "json",
      quiet: true,
      noInput: true,
      debug: false,
      dryRun: false,
      ndjson: false
    });

    await expect(client.post("/api/artifacts", {})).rejects.toMatchObject({
      kind: "auth",
      message: "Not signed in. Run `artifacts login`."
    });
    await expect(client.post("/api/artifacts", {})).rejects.toBeInstanceOf(CliError);
  });
});
