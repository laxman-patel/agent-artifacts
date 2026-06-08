import { Component, FileText, Globe, type LucideIcon } from "lucide-react";

// One source of truth for how each artifact type reads across the workbench:
// a glyph, a human label, and the quiet per-type accent from DESIGN.md.
interface ArtifactKindMeta {
  label: string;
  accent: string;
  Icon: LucideIcon;
}

const KINDS: Record<string, ArtifactKindMeta> = {
  html: { label: "HTML", accent: "var(--wb-accent-html)", Icon: Globe },
  md: { label: "Markdown", accent: "var(--wb-accent-md)", Icon: FileText },
  jsx: { label: "JSX", accent: "var(--wb-accent-jsx)", Icon: Component }
};

const FALLBACK: ArtifactKindMeta = { label: "File", accent: "var(--wb-accent-html)", Icon: FileText };

export function artifactKind(type: string): ArtifactKindMeta {
  return KINDS[type] ?? FALLBACK;
}
