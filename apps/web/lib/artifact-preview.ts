import { artifactPath, fetchArtifactContent, fetchArtifactMeta, type ArtifactMeta } from "./server-api";

const MAX_EXCERPT_LENGTH = 220;
const MAX_SOURCE_LINES = 8;

const TYPE_LABEL: Record<ArtifactMeta["type"], string> = {
  html: "HTML",
  md: "Markdown",
  jsx: "JSX"
};

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

export interface PublicArtifactPreview {
  id: string;
  title: string;
  description: string;
  excerpt: string;
  sourceLines: string[];
  type: ArtifactMeta["type"];
  typeLabel: string;
  ownerUsername: string;
  projectSlug: string;
  path: string;
  updatedAt: string;
  latestVersionId: string | null;
}

interface PublicArtifactPreviewOptions {
  includeContent?: boolean;
  versionNumber?: number;
}

export function artifactTypeLabel(type: ArtifactMeta["type"]): string {
  return TYPE_LABEL[type];
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    }
    return HTML_ENTITY_MAP[normalized] ?? match;
  });
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength = MAX_EXCERPT_LENGTH): string {
  const compacted = compactWhitespace(value);
  if (compacted.length <= maxLength) return compacted;
  return `${compacted.slice(0, maxLength - 1).trimEnd()}…`;
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[\s>*+-]+/gm, "")
    .replace(/[*_~]/g, "");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

export function artifactContentExcerpt(content: string, type: ArtifactMeta["type"]): string {
  if (!content.trim()) return "";

  if (type === "md") {
    return truncate(stripMarkdown(content));
  }

  if (type === "html") {
    return truncate(stripHtml(content));
  }

  return truncate(content);
}

export function artifactSourceLines(content: string, type: ArtifactMeta["type"]): string[] {
  const prepared = type === "html" ? stripHtml(content) : type === "md" ? stripMarkdown(content) : content;
  return prepared
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, MAX_SOURCE_LINES);
}

function fallbackDescription(meta: ArtifactMeta): string {
  return `A public ${artifactTypeLabel(meta.type)} artifact published by ${meta.ownerUsername}.`;
}

export async function loadPublicArtifactPreview(
  username: string,
  projectSlug: string,
  slug: string,
  options: PublicArtifactPreviewOptions = {}
): Promise<PublicArtifactPreview | null> {
  const metaResult = await fetchArtifactMeta(username, projectSlug, slug);
  if (!metaResult.ok || !metaResult.body.publicView) {
    return null;
  }

  const meta = metaResult.body;
  let content = "";
  if (options.includeContent) {
    const contentResult = await fetchArtifactContent(meta.id, undefined, options.versionNumber);
    if (contentResult.ok) {
      content = contentResult.body.content;
    }
  }

  const excerpt = content ? artifactContentExcerpt(content, meta.type) : "";
  const description = truncate(meta.description?.trim() || excerpt || fallbackDescription(meta));

  return {
    id: meta.id,
    title: meta.title,
    description,
    excerpt,
    sourceLines: content ? artifactSourceLines(content, meta.type) : [],
    type: meta.type,
    typeLabel: artifactTypeLabel(meta.type),
    ownerUsername: meta.ownerUsername,
    projectSlug: meta.projectSlug,
    path: artifactPath(meta),
    updatedAt: meta.updatedAt,
    latestVersionId: meta.latestVersionId
  };
}
