import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "../src/program.js";

vi.mock("../src/auth/credentials.js", () => ({
  loadStoredCredentials: () => null,
  credentialsPath: () => "/tmp/agent-artifacts-test-credentials.json",
  saveStoredCredentials: vi.fn(),
  clearStoredCredentials: vi.fn()
}));

describe("unknown command handling", () => {
  const out: string[] = [];
  const err: string[] = [];
  const exitCodes: number[] = [];

  beforeEach(() => {
    out.length = 0;
    err.length = 0;
    exitCodes.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      out.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      err.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      exitCodes.push(Number(code));
      throw new Error(`exit:${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a JSON failure envelope with a schema next action and exit 2", async () => {
    await expect(runCli(["node", "artifacts", "bogus", "--format", "json"])).rejects.toThrow("exit:2");

    const payload = JSON.parse(err.join(""));
    expect(payload.ok).toBe(false);
    expect(payload.error.kind).toBe("invalid_request");
    expect(payload.error.message).toContain("bogus");
    expect(payload.error.message).toContain("artifacts schema");
    expect(payload.next_actions[0].command).toBe("artifacts schema");
    expect(exitCodes).toContain(2);
    // Data streams stay clean: nothing leaks onto stdout.
    expect(out.join("")).toBe("");
  });

  it("swallows Commander's raw error text so agents only see the envelope", async () => {
    await expect(runCli(["node", "artifacts", "bogus", "--format", "json"])).rejects.toThrow("exit:2");
    expect(err.join("")).not.toContain("error: unknown command");
  });

  it("turns an unknown flag into the same machine-readable envelope", async () => {
    await expect(runCli(["node", "artifacts", "status", "--not-a-flag", "--format", "json"])).rejects.toThrow("exit:2");
    const payload = JSON.parse(err.join(""));
    expect(payload.ok).toBe(false);
    expect(payload.error.kind).toBe("invalid_request");
  });
});
