import { describe, expect, it } from "vitest";
import { requirePositional, resolveResourceArg } from "../src/args.js";
import { ARTIFACT_ID_ARG } from "../src/command-options.js";
import { CliError } from "../src/errors.js";

describe("requirePositional", () => {
  it("returns the positional value when present", () => {
    expect(requirePositional(["abc"], 0, "artifactId")).toBe("abc");
  });

  it("throws CliError with example when missing", () => {
    expect(() =>
      requirePositional([], 0, "artifactId", "artifacts artifact get ARTIFACT_ID")
    ).toThrow(CliError);
    try {
      requirePositional([], 0, "artifactId", "artifacts artifact get ARTIFACT_ID");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(2);
      expect((error as CliError).message).toContain("artifactId");
      expect((error as CliError).message).toContain("artifacts artifact get ARTIFACT_ID");
    }
  });
});

describe("resolveResourceArg", () => {
  it("accepts a named flag instead of a positional", () => {
    expect(resolveResourceArg([], { artifactId: "art_1" }, ARTIFACT_ID_ARG)).toBe("art_1");
  });

  it("prefers positional when only one source is provided", () => {
    expect(resolveResourceArg(["art_pos"], {}, ARTIFACT_ID_ARG)).toBe("art_pos");
  });

  it("rejects conflicting positional and flag values", () => {
    expect(() =>
      resolveResourceArg(["a"], { artifactId: "b" }, ARTIFACT_ID_ARG)
    ).toThrow(/Conflicting/);
  });
});
