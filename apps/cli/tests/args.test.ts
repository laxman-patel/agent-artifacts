import { describe, expect, it } from "vitest";
import { requirePositional } from "../src/args.js";
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
