import { describe, expect, it } from "vitest";
import {
  createReleaseManifest,
  releaseBinaryName,
  releaseSkillArchiveName,
  RELEASE_TARGETS,
  type ReleaseFileInfo,
  type ReleasePlatform
} from "../src/release-assets.js";

describe("release assets", () => {
  it("uses stable platform binary names", () => {
    expect(RELEASE_TARGETS.map((target) => releaseBinaryName("0.1.0", target.platform))).toEqual([
      "artifacts-0.1.0-linux-x64",
      "artifacts-0.1.0-linux-arm64",
      "artifacts-0.1.0-darwin-x64",
      "artifacts-0.1.0-darwin-arm64"
    ]);
    expect(releaseSkillArchiveName("0.1.0")).toBe("agent-artifacts-skill-0.1.0.tar.gz");
  });

  it("creates a manifest with checksums for every downloadable asset", () => {
    const binaries = Object.fromEntries(
      RELEASE_TARGETS.map((target) => [
        target.platform,
        {
          file: releaseBinaryName("0.1.0", target.platform),
          sha256: `${target.platform}-sha`,
          size: 123
        } satisfies ReleaseFileInfo
      ])
    ) as Record<ReleasePlatform, ReleaseFileInfo>;

    const manifest = createReleaseManifest({
      version: "0.1.0",
      generatedAt: "2026-06-22T00:00:00.000Z",
      cli: {
        baseUrl: "https://hostartifacts.dev",
        webUrl: "https://hostartifacts.dev"
      },
      binaries,
      skill: {
        file: "agent-artifacts-skill-0.1.0.tar.gz",
        sha256: "skill-sha",
        size: 456
      },
      installer: {
        file: "install.sh",
        sha256: "installer-sha",
        size: 789
      }
    });

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.binaries["linux-x64"]).toEqual({
      file: "artifacts-0.1.0-linux-x64",
      sha256: "linux-x64-sha",
      size: 123,
      target: "bun-linux-x64"
    });
    expect(manifest.skill.sha256).toBe("skill-sha");
    expect(manifest.installer.sha256).toBe("installer-sha");
  });
});
