import { describe, expect, it } from "vitest";
import { parseIntFlag } from "../src/parse-int-flag.js";
import { CliError } from "../src/errors.js";

describe("parseIntFlag", () => {
  it("parses valid integers", () => {
    expect(parseIntFlag("--limit", "example")("50")).toBe(50);
  });

  it("rejects non-numeric values", () => {
    expect(() => parseIntFlag("--limit", "example")("abc")).toThrow(CliError);
  });

  it("rejects partial numeric strings", () => {
    expect(() => parseIntFlag("--limit", "example")("12abc")).toThrow(CliError);
  });
});
