import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/client.js";
import { CliError } from "../src/errors.js";
import { inferArtifactType, slugFromArtifactTitle, titleFromArtifactFile } from "../src/artifact-file.js";
import { runCli } from "../src/program.js";

describe("artifact file push", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function writeTempFile(name: string, content: string): string {
    const dir = mkdtempSync(join(tmpdir(), "agent-artifacts-cli-"));
    tempDirs.push(dir);
    const filePath = join(dir, name);
    writeFileSync(filePath, content, "utf8");
    return filePath;
  }

  it("infers title, slug, and type from a Markdown file", async () => {
    const filePath = writeTempFile("weekly-report.md", "# Weekly Report\n\nShipped.");
    const post = vi.spyOn(ApiClient.prototype, "post").mockResolvedValue({
      artifactId: "artifact_123",
      versionNumber: 1,
      url: "https://app.example.com/alice/default/weekly-report"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "push",
      "--owner",
      "alice",
      "--project-slug",
      "default",
      "--file",
      filePath
    ]);

    expect(post).toHaveBeenCalledWith("/api/artifacts", {
      ownerUsername: "alice",
      projectSlug: "default",
      slug: "weekly-report",
      type: "md",
      title: "Weekly Report",
      content: "# Weekly Report\n\nShipped.",
      access: {
        publicView: true,
        publicEdit: false
      }
    });
  });

  it("omits ownerUsername so the API infers it when --owner is not given", async () => {
    const filePath = writeTempFile("weekly-report.md", "# Weekly Report\n\nShipped.");
    const post = vi.spyOn(ApiClient.prototype, "post").mockResolvedValue({
      artifactId: "artifact_123",
      url: "https://app.example.com/alice/default/weekly-report"
    });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "push",
      "--project-slug",
      "default",
      "--file",
      filePath
    ]);

    expect(post).toHaveBeenCalledTimes(1);
    const [, body] = post.mock.calls[0]!;
    expect(body).not.toHaveProperty("ownerUsername");
    expect(body).toMatchObject({ projectSlug: "default", slug: "weekly-report" });
  });

  it("honors metadata and access overrides", async () => {
    const filePath = writeTempFile("dashboard.html", "<!doctype html><h1>Dashboard</h1>");
    const post = vi.spyOn(ApiClient.prototype, "post").mockResolvedValue({ artifactId: "artifact_456" });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "push",
      "--owner",
      "alice",
      "--project-slug",
      "ops",
      "--file",
      filePath,
      "--title",
      "Ops Dashboard",
      "--slug",
      "ops-dashboard",
      "--type",
      "html",
      "--description",
      "Daily operations artifact",
      "--changelog",
      "Initial import",
      "--private",
      "--public-edit"
    ]);

    expect(post).toHaveBeenCalledWith("/api/artifacts", {
      ownerUsername: "alice",
      projectSlug: "ops",
      slug: "ops-dashboard",
      type: "html",
      title: "Ops Dashboard",
      description: "Daily operations artifact",
      changelog: "Initial import",
      content: "<!doctype html><h1>Dashboard</h1>",
      access: {
        publicView: false,
        publicEdit: true
      }
    });
  });

  it("retries with a numeric slug suffix when the inferred slug is taken", async () => {
    const filePath = writeTempFile("weekly-report.md", "# Weekly Report\n\nShipped.");
    const post = vi.spyOn(ApiClient.prototype, "post")
      .mockRejectedValueOnce(new CliError("conflict", "Slug is not available.", 5))
      .mockResolvedValueOnce({
        artifactId: "artifact_789",
        normalizedSlug: "weekly-report-1"
      });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "push",
      "--owner",
      "alice",
      "--project-slug",
      "default",
      "--file",
      filePath
    ]);

    expect(post).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenNthCalledWith(1, "/api/artifacts", expect.objectContaining({ slug: "weekly-report" }));
    expect(post).toHaveBeenNthCalledWith(2, "/api/artifacts", expect.objectContaining({ slug: "weekly-report-1" }));
  });

  it("keeps incrementing slug suffixes until a candidate is available", async () => {
    const filePath = writeTempFile("weekly-report.md", "# Weekly Report\n\nShipped.");
    const post = vi.spyOn(ApiClient.prototype, "post")
      .mockRejectedValueOnce(new CliError("conflict", "Slug is not available.", 5))
      .mockRejectedValueOnce(new CliError("conflict", "Slug is not available.", 5))
      .mockResolvedValueOnce({
        artifactId: "artifact_999",
        normalizedSlug: "weekly-report-2"
      });
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    await runCli([
      "node",
      "artifacts",
      "--token",
      "test-token",
      "push",
      "--owner",
      "alice",
      "--project-slug",
      "default",
      "--file",
      filePath
    ]);

    expect(post).toHaveBeenNthCalledWith(1, "/api/artifacts", expect.objectContaining({ slug: "weekly-report" }));
    expect(post).toHaveBeenNthCalledWith(2, "/api/artifacts", expect.objectContaining({ slug: "weekly-report-1" }));
    expect(post).toHaveBeenNthCalledWith(3, "/api/artifacts", expect.objectContaining({ slug: "weekly-report-2" }));
  });

  it("uses the same inference rules as web upload", () => {
    expect(inferArtifactType("component.tsx", "export default function Demo() { return <div />; }")).toBe("jsx");
    expect(inferArtifactType("fragment.txt", "<html><body>Hello</body></html>")).toBe("html");
    expect(titleFromArtifactFile("release_notes.md", "# Release Notes\n\nBody")).toBe("Release Notes");
    expect(titleFromArtifactFile("weekly-report.md", "No heading")).toBe("Weekly Report");
    expect(slugFromArtifactTitle("Weekly Report!")).toBe("weekly-report");
  });
});
