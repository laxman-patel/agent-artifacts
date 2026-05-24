import { config as dotenvConfig } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

function findMonorepoRoot(startDir: string): string | undefined {
  for (let dir = startDir; dir !== dirname(dir); dir = dirname(dir)) {
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    try {
      if ((JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string }).name === "agent-artifacts") return dir;
    } catch {
      // ignore invalid package.json
    }
  }
}

export function loadMonorepoEnv(startDir: string = process.cwd()): void {
  const root = findMonorepoRoot(startDir);
  if (!root) return;
  for (const file of [".env", ".env.local"] as const) {
    const path = join(root, file);
    if (existsSync(path)) dotenvConfig({ path, override: file === ".env.local" });
  }
}
