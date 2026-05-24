import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { emitSuccess, emitFailure, shouldUseColor } from "../src/output.js";
import { CliError, exitCodeForKind } from "../src/errors.js";

describe("CLI output", () => {
  const stdout: string[] = [];
  const stderr: string[] = [];

  beforeEach(() => {
    stdout.length = 0;
    stderr.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit:${code}`);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits ok JSON envelope by default for agents", () => {
    emitSuccess({ id: "a1" }, "json");
    const parsed = JSON.parse(stdout.join("")) as { ok: boolean; data: { id: string } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.id).toBe("a1");
  });

  it("writes JSON failures to stderr", () => {
    expect(() => emitFailure(new CliError("not_found", "missing", 3), "json")).toThrow("exit:3");
    expect(stdout.join("")).toBe("");
    const parsed = JSON.parse(stderr.join("")) as { ok: boolean; error: { kind: string } };
    expect(parsed.ok).toBe(false);
    expect(parsed.error.kind).toBe("not_found");
  });

  it("maps error kinds to stable exit codes", () => {
    expect(exitCodeForKind("not_found")).toBe(3);
    expect(exitCodeForKind("conflict")).toBe(5);
    expect(exitCodeForKind("forbidden")).toBe(4);
    expect(exitCodeForKind("network")).toBe(69);
  });

  it("respects NO_COLOR for future ANSI emitters", () => {
    const previous = process.env.NO_COLOR;
    process.env.NO_COLOR = "1";
    try {
      expect(shouldUseColor()).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.NO_COLOR;
      } else {
        process.env.NO_COLOR = previous;
      }
    }
  });
});
