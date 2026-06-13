import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { CliError } from "./errors.js";

const ARTIFACT_EXTENSION_PATTERN = /\.(md|markdown|html|htm|jsx|tsx)$/i;
export type ArtifactFileType = "md" | "html" | "jsx";

export function readArtifactFile(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError("invalid_request", `Failed to read --file ${path}: ${message}`, 2);
  }
}

export function inferArtifactType(filePath: string, content: string): ArtifactFileType {
  const lower = basename(filePath).toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  if (lower.endsWith(".jsx") || lower.endsWith(".tsx")) return "jsx";
  if (/<html[\s>]/i.test(content) || /<!doctype html/i.test(content)) return "html";
  return "md";
}

export function titleFromArtifactFile(filePath: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) return heading.slice(0, 200);

  const fileTitle = basename(filePath)
    .replace(ARTIFACT_EXTENSION_PATTERN, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 200);

  return fileTitle || "Untitled Artifact";
}

export function slugFromArtifactTitle(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-") || "artifact"
  );
}
