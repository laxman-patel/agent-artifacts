import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/client.js";
import { CliError } from "../src/errors.js";
import { runCli } from "../src/program.js";

vi.mock("../src/auth/credentials.js", () => ({
  loadStoredCredentials: () => null,
  credentialsPath: () => "/tmp/agent-artifacts-test-credentials.json",
  saveStoredCredentials: vi.fn(),
  clearStoredCredentials: vi.fn()
}));

describe("doctor", () => {
  const out: string[] = [];

  beforeEach(() => {
    out.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function payload() {
    return JSON.parse(out.join(""));
  }

  it("reports the unauthenticated state and probes reachability via health", async () => {
    const get = vi.spyOn(ApiClient.prototype, "get").mockResolvedValue({ ok: true });

    await runCli(["node", "artifacts", "doctor", "--format", "json"]);

    const body = payload();
    expect(body.ok).toBe(true);
    expect(body.data.auth.authenticated).toBe(false);
    expect(body.data.api.reachable).toBe(true);
    expect(body.data.api.checkedVia).toBe("health");
    expect(body.data.healthy).toBe(false);
    expect(body.next_actions.some((a: { command: string }) => a.command === "artifacts login")).toBe(true);
    expect(get).toHaveBeenCalledWith("/api/health");
  });

  it("resolves identity via whoami when authenticated", async () => {
    const get = vi.spyOn(ApiClient.prototype, "get").mockResolvedValue({
      user: { email: "alice@example.com", name: "Alice" },
      profile: { username: "alice" }
    });

    await runCli(["node", "artifacts", "--token", "test-token", "doctor", "--format", "json"]);

    const body = payload();
    expect(body.data.auth.authenticated).toBe(true);
    expect(body.data.api.checkedVia).toBe("whoami");
    expect(body.data.identity).toEqual({ username: "alice", email: "alice@example.com", name: "Alice" });
    expect(body.data.healthy).toBe(true);
    expect(get).toHaveBeenCalledWith("/api/profile/me");
  });

  it("flags a rejected token without throwing", async () => {
    vi.spyOn(ApiClient.prototype, "get").mockRejectedValue(new CliError("forbidden", "Not signed in.", 4));

    await runCli(["node", "artifacts", "--token", "test-token", "doctor", "--format", "json"]);

    const body = payload();
    expect(body.data.api.reachable).toBe(true);
    expect(body.data.identityError.kind).toBe("forbidden");
    expect(body.data.healthy).toBe(false);
    expect(body.next_actions[0].command).toBe("artifacts login");
  });

  it("marks the API unreachable on a network failure", async () => {
    vi.spyOn(ApiClient.prototype, "get").mockRejectedValue(new CliError("network", "Could not reach the API.", 69));

    await runCli(["node", "artifacts", "--token", "test-token", "doctor", "--format", "json"]);

    const body = payload();
    expect(body.data.api.reachable).toBe(false);
    expect(body.data.api.error).toContain("Could not reach");
    expect(body.data.healthy).toBe(false);
  });
});
