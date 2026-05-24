import { describe, expect, it } from "vitest";
import { parseJsonInput } from "../src/json-input.js";

describe("parseJsonInput", () => {
  it("parses inline --json payloads", () => {
    expect(parseJsonInput('{"a":1}')).toEqual({ a: 1 });
  });

  it("includes example invocation when JSON is missing", () => {
    expect(() => parseJsonInput(undefined, undefined, { example: "artifacts project create --json '{...}'" })).toThrow(
      /artifacts project create/
    );
  });

  it("rejects using both --json and --json-file", () => {
    expect(() => parseJsonInput("{}", "file.json")).toThrow(/only one/);
  });
});
