import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const installer = readFileSync(join(repoRoot, "scripts", "install.sh"), "utf8");
const skill = readFileSync(join(repoRoot, "skills", "agent-artifacts", "SKILL.md"), "utf8");

describe("public installer script", () => {
  it("downloads release assets from GitHub Releases by default", () => {
    expect(installer).toContain(
      "ARTIFACTS_DOWNLOAD_BASE_URL:-https://github.com/laxman-patel/agent-artifacts/releases"
    );
    expect(installer).toContain("printf '%s/latest/download' \"$DOWNLOAD_BASE_URL\"");
    expect(installer).toContain("printf '%s/download/%s' \"$DOWNLOAD_BASE_URL\" \"$VERSION\"");
    expect(installer).toContain("printf '%s/download/v%s' \"$DOWNLOAD_BASE_URL\" \"$VERSION\"");
    expect(installer).toContain("printf '%s/latest' \"$DOWNLOAD_BASE_URL\"");
    expect(installer).toContain("download \"$RELEASE_URL/manifest.json\" \"$MANIFEST\"");
    expect(installer).toContain("download \"$base_url/$asset_file\" \"$tmp_cli\"");
  });

  it("requires Node and verifies checksums before replacing the installed CLI", () => {
    expect(installer).toContain("curl -fL --proto '=https' --tlsv1.2");
    expect(installer).toContain("need node");
    expect(installer).toContain("Node.js 24 or newer is required");
    expect(installer).toContain("ARTIFACTS_ALLOW_INSECURE");
    expect(installer).toContain("refusing non-HTTPS download URL");
    expect(installer).toContain("verify_sha256 \"$tmp_cli\" \"$asset_sha\"");
    expect(installer).toContain("mv \"$install_tmp\" \"$target\"");
  });

  it("delegates multi-agent skill installation to Vercel skills", () => {
    expect(installer).toContain(
      "ARTIFACTS_SKILL_SOURCE:-https://github.com/laxman-patel/agent-artifacts"
    );
    expect(installer).toContain("ARTIFACTS_SKILL_AGENTS:-*");
    expect(installer).toContain("npx -y skills add");
    expect(installer).toContain("--global --copy -y");
    expect(installer).toContain("ARTIFACTS_SKIP_SKILLS");
  });
});

describe("agent-artifacts skill package", () => {
  it("has Vercel skills-compatible frontmatter and CLI guidance", () => {
    expect(skill).toContain("name: agent-artifacts");
    expect(skill).toContain("description:");
    expect(skill).toContain("artifacts schema --format json");
    expect(skill).toContain("curl -fsSL https://hostartifacts.dev/install.sh | sh");
  });
});
