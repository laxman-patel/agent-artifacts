import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runCli } from "../src/program.js";

describe("--no-input flag", () => {
  const stderr: string[] = [];
  const exitCodes: number[] = [];

  beforeEach(() => {
    stderr.length = 0;
    exitCodes.length = 0;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
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

  it("propagates --no-input to login and fails without prompting", async () => {
    await expect(runCli(["node", "artifacts", "login", "--no-input", "--format", "json"])).rejects.toThrow(
      "exit:2"
    );
    expect(exitCodes).toEqual([2]);
    const payload = JSON.parse(stderr.join("")) as { ok: boolean; error: { kind: string } };
    expect(payload.ok).toBe(false);
    expect(payload.error.kind).toBe("invalid_request");
  });
});
