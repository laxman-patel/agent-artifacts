import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function findMonorepoRoot(startDir: string): string | undefined {
  let dir = startDir;

  while (true) {
    const packageJsonPath = join(dir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string };
        if (pkg.name === "agent-artifacts") {
          return dir;
        }
      } catch {
        // ignore invalid package.json
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      return undefined;
    }

    dir = parent;
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function applyEnvFile(path: string, overrideExisting: boolean): void {
  if (!existsSync(path)) {
    return;
  }

  const parsed = parseEnvFile(readFileSync(path, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    if (overrideExisting || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadMonorepoEnv(startDir: string = process.cwd()): void {
  const root = findMonorepoRoot(startDir);
  if (!root) {
    return;
  }

  applyEnvFile(join(root, ".env"), false);
  applyEnvFile(join(root, ".env.local"), true);
}
