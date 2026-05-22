import { describe, expect, it } from "vitest";
import { resolveProdBuildUrls } from "../src/prod-build-urls.js";

describe("resolveProdBuildUrls", () => {
  it("prefers AGENT_ARTIFACTS_* when set", () => {
    expect(
      resolveProdBuildUrls({
        AGENT_ARTIFACTS_BASE_URL: "https://api.example.com/",
        AGENT_ARTIFACTS_WEB_URL: "https://app.example.com/",
        INTERNAL_API_URL: "http://127.0.0.1:3001",
        PUBLIC_APP_URL: "http://localhost:3000"
      })
    ).toEqual({
      baseUrl: "https://api.example.com",
      webUrl: "https://app.example.com"
    });
  });

  it("falls back to INTERNAL_API_URL and PUBLIC_APP_URL from .env", () => {
    expect(
      resolveProdBuildUrls({
        INTERNAL_API_URL: "https://api.prod.com",
        PUBLIC_APP_URL: "https://prod.com"
      })
    ).toEqual({
      baseUrl: "https://api.prod.com",
      webUrl: "https://prod.com"
    });
  });

  it("returns null when URLs are missing", () => {
    expect(resolveProdBuildUrls({})).toBeNull();
    expect(resolveProdBuildUrls({ INTERNAL_API_URL: "https://api.example.com" })).toBeNull();
  });
});
