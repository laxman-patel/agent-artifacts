import { describe, expect, it } from "vitest";
import { requireFlag } from "../src/args.js";
import { ARTIFACT_ID_FLAG } from "../src/command-options.js";
import { CliError } from "../src/errors.js";

describe("requireFlag", () => {
  it("returns the flag value when present", () => {
    expect(requireFlag({ artifactId: "art_1" }, ARTIFACT_ID_FLAG)).toBe("art_1");
  });

  it("throws CliError with example when the flag is missing", () => {
    expect(() => requireFlag({}, ARTIFACT_ID_FLAG)).toThrow(CliError);
    try {
      requireFlag({}, ARTIFACT_ID_FLAG);
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).exitCode).toBe(2);
      expect((error as CliError).message).toContain("--artifact-id");
      expect((error as CliError).message).toContain("artifacts artifact get --artifact-id ARTIFACT_ID");
    }
  });
});
