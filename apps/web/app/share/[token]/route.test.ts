import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("share route", () => {
  it("sets the artifact share cookie on the redirect response", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        artifactId: "artifact_123",
        role: "viewer",
        artifact: {
          ownerUsername: "laxman",
          projectSlug: "default",
          slug: "private-demo"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new NextRequest("https://agent-artifacts.test/share/share_token"), {
      params: Promise.resolve({ token: "share_token" })
    });

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://agent-artifacts.test/laxman/default/private-demo");
    expect(response.headers.get("set-cookie")).toContain("aa_share_artifact_123=share_token");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3001/api/share/share_token", { cache: "no-store" });
  });

  it("returns not found for missing or expired share tokens", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(
      new Response("missing", { status: 410 })
    ));

    const response = await GET(new NextRequest("https://agent-artifacts.test/share/missing"), {
      params: Promise.resolve({ token: "missing" })
    });

    expect(response.status).toBe(404);
  });
});
