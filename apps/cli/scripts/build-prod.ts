import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadProdBuildUrls } from "../src/prod-build-urls.js";

const cliDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const monorepoRoot = join(cliDir, "../..");
const urls = loadProdBuildUrls(monorepoRoot);

function readCliVersion(): string {
  const packageJsonPath = join(cliDir, "package.json");
  const parsed = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  if (typeof parsed.version !== "string" || parsed.version.length === 0) {
    throw new Error(`Missing version in ${packageJsonPath}`);
  }
  return parsed.version;
}

if (!urls) {
  console.error("Production CLI build requires API and web URLs in the repo .env file.");
  console.error("");
  console.error("Set either:");
  console.error("  AGENT_ARTIFACTS_BASE_URL + AGENT_ARTIFACTS_WEB_URL");
  console.error("or the standard app vars:");
  console.error("  INTERNAL_API_URL          (API, e.g. https://api.example.com)");
  console.error("  PUBLIC_APP_URL            (web, e.g. https://example.com)");
  console.error("");
  console.error(`Looked for .env under: ${monorepoRoot}`);
  process.exit(1);
}

const { baseUrl, webUrl } = urls;
const version = readCliVersion();
const outFile = join(cliDir, "dist", "artifacts");
mkdirSync(dirname(outFile), { recursive: true });

const proc = Bun.spawnSync(
  [
    "bun",
    "build",
    join(cliDir, "src", "cli.ts"),
    "--compile",
    "--minify",
    "--outfile",
    outFile,
    "--define",
    `globalThis.__CLI_DEFAULT_BASE_URL__=${JSON.stringify(baseUrl)}`,
    "--define",
    `globalThis.__CLI_DEFAULT_WEB_URL__=${JSON.stringify(webUrl)}`,
    "--define",
    `globalThis.__CLI_VERSION__=${JSON.stringify(version)}`
  ],
  {
    cwd: cliDir,
    stdio: ["inherit", "inherit", "inherit"]
  }
);

if (proc.exitCode !== 0) {
  process.exit(proc.exitCode ?? 1);
}

if (!existsSync(outFile)) {
  console.error(`Build finished but ${outFile} was not created.`);
  process.exit(1);
}

console.error(`Built production CLI → ${outFile}`);
console.error(`  API: ${baseUrl}`);
console.error(`  Web: ${webUrl}`);
