import { describe, expect, it } from "vitest";
import { extractFormatFlag, resolveConfig } from "../src/config.js";

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
});
