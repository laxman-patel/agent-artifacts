import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { emitSuccess } from "../src/output.js";
import { exitCodeForKind } from "../src/errors.js";

describe("CLI output", () => {
  const writes: string[] = [];

  beforeEach(() => {
    writes.length = 0;
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits ok JSON envelope by default for agents", () => {
    emitSuccess({ id: "a1" }, "json");
    const parsed = JSON.parse(writes.join("")) as { ok: boolean; data: { id: string } };
    expect(parsed.ok).toBe(true);
    expect(parsed.data.id).toBe("a1");
  });

  it("maps error kinds to stable exit codes", () => {
    expect(exitCodeForKind("not_found")).toBe(3);
    expect(exitCodeForKind("conflict")).toBe(5);
    expect(exitCodeForKind("forbidden")).toBe(4);
  });
});
