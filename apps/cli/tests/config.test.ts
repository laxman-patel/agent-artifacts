import { describe, expect, it } from "vitest";
import { extractFormatFlag, preParseGlobals, resolveConfig } from "../src/config.js";

describe("extractFormatFlag", () => {
  it("parses --format json", () => {
    expect(extractFormatFlag(["node", "artifacts", "whoami", "--format", "json"])).toBe("json");
  });

  it("parses --format=json", () => {
    expect(extractFormatFlag(["node", "artifacts", "whoami", "--format=json"])).toBe("json");
  });

  it("returns undefined when format is absent", () => {
    expect(extractFormatFlag(["node", "artifacts", "whoami"])).toBeUndefined();
  });
});

describe("resolveConfig format", () => {
  it("honors AGENT_ARTIFACTS_FORMAT", () => {
    const previous = process.env.AGENT_ARTIFACTS_FORMAT;
    process.env.AGENT_ARTIFACTS_FORMAT = "json";
    try {
      expect(resolveConfig({}).format).toBe("json");
    } finally {
      if (previous === undefined) {
        delete process.env.AGENT_ARTIFACTS_FORMAT;
      } else {
        process.env.AGENT_ARTIFACTS_FORMAT = previous;
      }
    }
  });

  it("honors AGENT_ARTIFACTS_NO_INPUT", () => {
    const previous = process.env.AGENT_ARTIFACTS_NO_INPUT;
    process.env.AGENT_ARTIFACTS_NO_INPUT = "1";
    try {
      expect(resolveConfig({}).noInput).toBe(true);
    } finally {
      if (previous === undefined) {
        delete process.env.AGENT_ARTIFACTS_NO_INPUT;
      } else {
        process.env.AGENT_ARTIFACTS_NO_INPUT = previous;
      }
    }
  });

  it("prefers explicit --no-input over env", () => {
    expect(resolveConfig({ noInput: false }).noInput).toBe(false);
  });
});

describe("preParseGlobals", () => {
  it("detects --no-input, --verbose, and --ndjson from argv", () => {
    expect(
      preParseGlobals(["node", "artifacts", "whoami", "--no-input", "--verbose", "--ndjson"])
    ).toEqual({
      format: undefined,
      noInput: true,
      debug: true,
      ndjson: true
    });
  });
});
