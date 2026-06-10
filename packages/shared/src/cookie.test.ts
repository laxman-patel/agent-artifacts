import { describe, expect, it } from "vitest";
import { readSessionCookie } from "./cookie.js";

describe("readSessionCookie", () => {
  it("reads the secure better-auth session cookie first", () => {
    expect(
      readSessionCookie(
        "better-auth.session_token=dev-token; __Secure-better-auth.session_token=secure-token"
      )
    ).toBe("secure-token");
  });

  it("falls back to the development better-auth session cookie", () => {
    expect(readSessionCookie("better-auth.session_token=dev-token")).toBe("dev-token");
  });

  it("reads from cookie stores with get(name)", () => {
    const store = new Map([
      ["better-auth.session_token", { value: "dev-token" }],
      ["__Secure-better-auth.session_token", { value: "secure-token" }]
    ]);

    expect(readSessionCookie({ get: (name: string) => store.get(name) })).toBe("secure-token");
  });
});
