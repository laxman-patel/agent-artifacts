import { describe, expect, it } from "vitest";
import { DEFAULT_BASE_URL, DEFAULT_WEB_URL } from "../src/build-defaults.js";

describe("build defaults", () => {
  it("uses localhost fallbacks in dev builds", () => {
    expect(DEFAULT_BASE_URL).toBe("http://127.0.0.1:3001");
    expect(DEFAULT_WEB_URL).toBe("http://localhost:3000");
  });
});
