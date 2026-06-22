import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

declare global {
  var __CLI_VERSION__: string | undefined;
}

export function readCliVersion(): string {
  if (globalThis.__CLI_VERSION__) {
    return globalThis.__CLI_VERSION__;
  }

  for (const candidate of ["../package.json", "../../package.json"]) {
    try {
      const packageJsonPath = fileURLToPath(new URL(candidate, import.meta.url));
      const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
      if (pkg.version) {
        return pkg.version;
      }
    } catch {
      // Try the next build layout candidate.
    }
  }
  return "0.0.0";
}
