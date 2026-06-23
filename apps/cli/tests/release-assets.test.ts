import { describe, expect, it } from "vitest";
import {
  createReleaseManifest,
  MIN_NODE_MAJOR,
  releaseCliAssetName,
  releaseSkillArchiveName,
} from "../src/release-assets.js";

describe("release assets", () => {
  it("uses stable release asset names", () => {
    expect(releaseCliAssetName("0.1.0")).toBe("artifacts-0.1.0");
    expect(releaseSkillArchiveName("0.1.0")).toBe("agent-artifacts-skill-0.1.0.tar.gz");
  });

  it("creates a manifest with checksums for every downloadable asset", () => {
    const manifest = createReleaseManifest({
      version: "0.1.0",
      generatedAt: "2026-06-22T00:00:00.000Z",
      cli: {
        baseUrl: "https://hostartifacts.dev",
        webUrl: "https://hostartifacts.dev",
        file: "artifacts-0.1.0",
        sha256: "cli-sha",
        size: 123
      },
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

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.node.minMajor).toBe(MIN_NODE_MAJOR);
    expect(manifest.cli.file).toBe("artifacts-0.1.0");
    expect(manifest.cli.sha256).toBe("cli-sha");
    expect(manifest.skill.sha256).toBe("skill-sha");
    expect(manifest.installer.sha256).toBe("installer-sha");
  });
});
