import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createReleaseManifest,
  releaseBinaryName,
  releaseSkillArchiveName,
  RELEASE_TARGETS,
  type ReleaseFileInfo,
  type ReleasePlatform
} from "../src/release-assets.js";
import { loadProdBuildUrls } from "../src/prod-build-urls.js";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = join(cliDir, "../..");
const releaseRoot = join(cliDir, "dist", "release");
const skillDir = join(monorepoRoot, "skills", "agent-artifacts");
const installerPath = join(monorepoRoot, "scripts", "install.sh");
const packageJsonPath = join(cliDir, "package.json");

function readCliVersion(): string {
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`Missing version in ${packageJsonPath}`);
  }
  return parsed.version;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function fileInfo(filePath: string): ReleaseFileInfo {
  return {
    file: basename(filePath),
    sha256: sha256File(filePath),
    size: statSync(filePath).size
  };
}

function run(command: string, args: string[], cwd: string): void {
  const proc = Bun.spawnSync([command, ...args], {
    cwd,
    stdio: ["inherit", "inherit", "inherit"]
  });

  if (proc.exitCode !== 0) {
    process.exit(proc.exitCode ?? 1);
  }
}

function copyDirectoryFiles(sourceDir: string, targetDir: string): void {
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });

  for (const entry of readdirSync(sourceDir)) {
    copyFileSync(join(sourceDir, entry), join(targetDir, entry));
  }
}

const urls = loadProdBuildUrls(monorepoRoot);

if (!urls) {
  console.error("Production CLI release requires API and web URLs in the repo .env file.");
  console.error("");
  console.error("Set either:");
  console.error("  AGENT_ARTIFACTS_BASE_URL + AGENT_ARTIFACTS_WEB_URL");
  console.error("or the standard app vars:");
  console.error("  INTERNAL_API_URL          (API, e.g. https://hostartifacts.dev)");
  console.error("  PUBLIC_APP_URL            (web, e.g. https://hostartifacts.dev)");
  console.error("");
  console.error(`Looked for .env under: ${monorepoRoot}`);
  process.exit(1);
}

if (!existsSync(skillDir)) {
  console.error(`Missing skill package at ${skillDir}`);
  process.exit(1);
}

if (!existsSync(installerPath)) {
  console.error(`Missing installer script at ${installerPath}`);
  process.exit(1);
}

const version = readCliVersion();
const versionDir = join(releaseRoot, `v${version}`);
const latestDir = join(releaseRoot, "latest");
const binaryAssets = {} as Record<ReleasePlatform, ReleaseFileInfo>;

rmSync(versionDir, { recursive: true, force: true });
mkdirSync(versionDir, { recursive: true });

for (const target of RELEASE_TARGETS) {
  const outFile = join(versionDir, releaseBinaryName(version, target.platform));
  run(
    "bun",
    [
      "build",
      join(cliDir, "src", "cli.ts"),
      "--compile",
      "--minify",
      "--target",
      target.bunTarget,
      "--outfile",
      outFile,
      "--define",
      `globalThis.__CLI_DEFAULT_BASE_URL__=${JSON.stringify(urls.baseUrl)}`,
      "--define",
      `globalThis.__CLI_DEFAULT_WEB_URL__=${JSON.stringify(urls.webUrl)}`,
      "--define",
      `globalThis.__CLI_VERSION__=${JSON.stringify(version)}`
    ],
    cliDir
  );
  binaryAssets[target.platform] = fileInfo(outFile);
}

const skillArchivePath = join(versionDir, releaseSkillArchiveName(version));
run("tar", ["-czf", skillArchivePath, "-C", dirname(skillDir), basename(skillDir)], monorepoRoot);

const installerReleasePath = join(versionDir, "install.sh");
copyFileSync(installerPath, installerReleasePath);

const manifest = createReleaseManifest({
  version,
  generatedAt: new Date().toISOString(),
  cli: {
    baseUrl: urls.baseUrl,
    webUrl: urls.webUrl
  },
  binaries: binaryAssets,
  skill: fileInfo(skillArchivePath),
  installer: fileInfo(installerReleasePath)
});

writeFileSync(join(versionDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
copyDirectoryFiles(versionDir, latestDir);

console.error(`Built CLI release assets in ${versionDir}`);
console.error(`Mirrored latest release assets in ${latestDir}`);
console.error(`  API: ${urls.baseUrl}`);
console.error(`  Web: ${urls.webUrl}`);
