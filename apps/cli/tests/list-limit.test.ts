import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolveListLimit, sliceListResult } from "../src/list-limit.js";
import type { CliConfig } from "../src/config.js";
import { CliError } from "../src/errors.js";

describe("resolveListLimit", () => {
  it("defaults to 50 records", () => {
    expect(resolveListLimit({})).toEqual({
      apiLimit: 50,
      clientLimit: 50,
      all: false
    });
  });

  it("honors --all", () => {
    expect(resolveListLimit({ all: true })).toEqual({
      apiLimit: undefined,
      clientLimit: undefined,
      all: true
    });
  });

  it("rejects limits outside the allowed range", () => {
    expect(() => resolveListLimit({ limit: 0 })).toThrow(CliError);
    expect(() => resolveListLimit({ limit: -5 })).toThrow(CliError);
    expect(() => resolveListLimit({ limit: 9999 })).toThrow(CliError);
  });

  it("accepts explicit limits within range", () => {
    expect(resolveListLimit({ limit: 100 }).apiLimit).toBe(100);
  });
});

describe("sliceListResult", () => {
  const stderr: string[] = [];
  const config = { quiet: false } as CliConfig;

  beforeEach(() => {
    stderr.length = 0;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("truncates and writes a hint on stderr", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const { items: sliced, truncated } = sliceListResult(items, resolveListLimit({ limit: 3 }), config, "items");
    expect(sliced).toEqual([0, 1, 2]);
    expect(truncated).toBe(true);
    expect(stderr.join("")).toContain("--all");
  });
});
