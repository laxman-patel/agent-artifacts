import { afterEach, describe, expect, it } from "vitest";
import { internalApiOrigin } from "./server-api";

const originalInternalApiUrl = process.env.INTERNAL_API_URL;

describe("internalApiOrigin", () => {
  afterEach(() => {
    if (originalInternalApiUrl === undefined) {
      delete process.env.INTERNAL_API_URL;
    } else {
      process.env.INTERNAL_API_URL = originalInternalApiUrl;
    }
  });

  it("allows loopback and private service origins", () => {
    process.env.INTERNAL_API_URL = "http://127.0.0.1:3001/";
    expect(internalApiOrigin()).toBe("http://127.0.0.1:3001");

    process.env.INTERNAL_API_URL = "http://api:3001";
    expect(internalApiOrigin()).toBe("http://api:3001");

    process.env.INTERNAL_API_URL = "http://api.internal:3001";
    expect(internalApiOrigin()).toBe("http://api.internal:3001");
  });

  it("rejects public origins before forwarding cookies", () => {
    process.env.INTERNAL_API_URL = "https://api.example.com";
    expect(() => internalApiOrigin()).toThrow(/INTERNAL_API_URL/);
  });
});
