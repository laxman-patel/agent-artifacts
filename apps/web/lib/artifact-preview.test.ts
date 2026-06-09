import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactMeta } from "./server-api";
import {
  artifactContentExcerpt,
  artifactSourceLines,
  loadPublicArtifactPreview
} from "./artifact-preview";
import { fetchArtifactContent, fetchArtifactMeta } from "./server-api";

vi.mock("./server-api", () => ({
  artifactPath: (artifact: { ownerUsername: string; projectSlug: string; slug: string }) =>
    `/${artifact.ownerUsername}/${artifact.projectSlug}/${artifact.slug}`,
  fetchArtifactContent: vi.fn(),
  fetchArtifactMeta: vi.fn()
}));

const publicMeta: ArtifactMeta = {
  id: "artifact_1",
  ownerUserId: "user_1",
  ownerUsername: "laxman",
  workspaceId: "workspace_1",
  workspaceSlug: "laxman",
  projectId: "project_1",
  projectSlug: "launch",
  slug: "demo",
  title: "Launch demo",
  description: null,
  type: "md",
  publicView: true,
  publicEdit: false,
  latestVersionId: "version_2",
  updatedAt: "2026-06-09T15:00:00.000Z"
};

const mockedFetchArtifactMeta = vi.mocked(fetchArtifactMeta);
const mockedFetchArtifactContent = vi.mocked(fetchArtifactContent);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("artifactContentExcerpt", () => {
  it("extracts readable text from markdown without link syntax", () => {
    const excerpt = artifactContentExcerpt(
      "# Release Notes\n\nShip the [public demo](https://example.com) with `agent` controls.\n\n```ts\nconst secret = true;\n```",
      "md"
    );

    expect(excerpt).toBe("Release Notes Ship the public demo with agent controls.");
  });

  it("strips scripts, tags, and decodes common entities from HTML", () => {
    const excerpt = artifactContentExcerpt(
      "<main><h1>Revenue &amp; Usage</h1><script>window.token='secret'</script><p>Q2 is &gt; Q1.</p></main>",
      "html"
    );

    expect(excerpt).toBe("Revenue & Usage Q2 is > Q1.");
  });
});

describe("artifactSourceLines", () => {
  it("returns compact non-empty preview lines", () => {
    expect(artifactSourceLines("\n\n# Title\n\n- First point\n- Second point\n", "md")).toEqual([
      "Title",
      "First point",
      "Second point"
    ]);
  });
});

describe("loadPublicArtifactPreview", () => {
  it("returns null when the artifact cannot be read anonymously", async () => {
    mockedFetchArtifactMeta.mockResolvedValue({ ok: false, status: 403, message: "Forbidden" });

    await expect(loadPublicArtifactPreview("laxman", "launch", "demo")).resolves.toBeNull();
    expect(mockedFetchArtifactContent).not.toHaveBeenCalled();
  });

  it("returns null when metadata is readable but public view is disabled", async () => {
    mockedFetchArtifactMeta.mockResolvedValue({
      ok: true,
      status: 200,
      body: { ...publicMeta, publicView: false }
    });

    await expect(loadPublicArtifactPreview("laxman", "launch", "demo", { includeContent: true })).resolves.toBeNull();
    expect(mockedFetchArtifactContent).not.toHaveBeenCalled();
  });

  it("builds a public preview with sanitized content", async () => {
    mockedFetchArtifactMeta.mockResolvedValue({ ok: true, status: 200, body: publicMeta });
    mockedFetchArtifactContent.mockResolvedValue({
      ok: true,
      status: 200,
      body: {
        content: "# Launch demo\n\nPublic artifact preview for messaging apps.",
        contentType: "text/markdown"
      }
    });

    await expect(loadPublicArtifactPreview("laxman", "launch", "demo", { includeContent: true })).resolves.toMatchObject({
      title: "Launch demo",
      description: "Launch demo Public artifact preview for messaging apps.",
      path: "/laxman/launch/demo",
      sourceLines: ["Launch demo", "Public artifact preview for messaging apps."]
    });
  });
});
