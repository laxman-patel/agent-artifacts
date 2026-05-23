import { chmod, copyFile, mkdir, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const useProd = process.argv.includes("--prod");
const source = path.join(repoRoot, "apps/cli/dist", useProd ? "artifacts" : "cli.js");
const binDir = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".local", "bin");
const target = path.join(binDir, process.platform === "win32" ? "artifacts.cmd" : "artifacts");

await mkdir(binDir, { recursive: true });

if (process.platform === "win32") {
  if (useProd) {
    await copyFile(source, path.join(binDir, "artifacts.exe"));
    await writeFile(target, `@echo off\r\n"%~dp0artifacts.exe" %*\r\n`, "utf8");
  } else {
    const launcher = source.replace(/\\/g, "\\\\");
    await writeFile(target, `@echo off\r\nnode "${launcher}" %*\r\n`, "utf8");
  }
} else {
  try {
    await unlink(target);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
      throw error;
    }
  }

  await symlink(source, target);
}

process.stdout.write(`Installed CLI to ${target}\n`);
