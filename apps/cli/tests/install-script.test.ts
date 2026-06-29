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
    expect(installer).toContain("curl -fsSL --proto '=https' --tlsv1.2");
    expect(installer).toContain("need node");
    expect(installer).toContain("Node.js 24 or newer is required");
    expect(installer).toContain("ARTIFACTS_ALLOW_INSECURE");
    expect(installer).toContain("refusing non-HTTPS download URL");
    expect(installer).toContain("verify_sha256 \"$tmp_cli\" \"$asset_sha\"");
    expect(installer).toContain("mv \"$install_tmp\" \"$target\"");
  });

  it("starts browser login immediately after installing the CLI", () => {
    expect(installer).toContain("ARTIFACTS_SKIP_LOGIN");
    expect(installer).toContain("CLI_PATH=\"$target\"");
    expect(installer).toContain("run_login \"$CLI_PATH\"");
    expect(installer).toContain("if \"$cli_path\" login; then");

    expect(installer.indexOf("install_cli \"$RELEASE_URL\" \"$MANIFEST\"")).toBeLessThan(
      installer.indexOf("run_login \"$CLI_PATH\"")
    );
    expect(installer.indexOf("run_login \"$CLI_PATH\"")).toBeLessThan(
      installer.indexOf("run_skills \"$agents\"")
    );
  });

  it("delegates skill installation to Vercel skills for the chosen agents", () => {
    expect(installer).toContain(
      "ARTIFACTS_SKILL_SOURCE:-https://github.com/laxman-patel/agent-artifacts"
    );
    // Empty default so the installer prompts/auto-detects instead of targeting every agent.
    expect(installer).toContain("ARTIFACTS_SKILL_AGENTS:-}");
    expect(installer).toContain("npx -y skills add");
    expect(installer).toContain("--global --copy -y");
    expect(installer).toContain('set -- "$@" --agent "$agent"');
    expect(installer).toContain("ARTIFACTS_SKIP_SKILLS");
  });

  it("offers an interactive agent picker with detection over /dev/tty", () => {
    expect(installer).toContain("ARTIFACTS_TTY:-/dev/tty");
    expect(installer).toContain("is_interactive()");
    expect(installer).toContain("choose_agents");
    expect(installer).toContain("preselect_detected");
    expect(installer).toContain("exec 3<\"$TTY_DEV\"");
    expect(installer).toContain("read -r _input <&3");
    expect(installer).toContain("toggle numbers");
    expect(installer).toContain("enter confirm");
    // Curated, common agents with their `skills` slugs.
    expect(installer).toContain("cursor|Cursor|");
    expect(installer).toContain("claude-code|Claude Code|");
    expect(installer).toContain("github-copilot|GitHub Copilot|");
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
