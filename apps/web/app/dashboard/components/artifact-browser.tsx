import Link from "next/link";
import type { CSSProperties } from "react";
import { artifactPath, type ArtifactOwnerSummary } from "../../../lib/server-api";
import { artifactKind } from "./artifact-kind";
import { ArtifactThumbnail } from "./artifact-thumbnail";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

function ArtifactTile({
  artifact,
  showProject,
  previewContent
}: {
  artifact: ArtifactOwnerSummary;
  showProject: boolean;
  previewContent?: string;
}) {
  const kind = artifactKind(artifact.type);
  const meta = `${showProject ? `${artifact.projectSlug}/` : ""}${artifact.slug}`;

  return (
    <Link
      href={artifactPath(artifact)}
      style={{ "--artifact-accent": kind.accent } as CSSProperties}
      className="artifact-card group flex flex-col rounded-[11px] focus-visible:outline-none"
    >
      <div className="rounded-[11px] border border-border p-1 transition-colors group-focus-visible:border-foreground/45">
        <div className="artifact-preview relative aspect-[4/3] overflow-hidden rounded-md border">
          <ArtifactThumbnail artifactId={artifact.id} type={artifact.type} content={previewContent} />
          <div className="pointer-events-none absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-[0.3rem] border border-border bg-[var(--wb-content)]/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-foreground/70 backdrop-blur-sm">
            <kind.Icon className="size-2.5" style={{ color: kind.accent }} aria-hidden />
            {kind.label}
          </div>
        </div>
      </div>
      <div className="mt-2.5 min-w-0 px-1">
        <p className="truncate text-[13px] font-semibold leading-snug text-foreground/90 transition-colors group-hover:text-foreground">
          {artifact.title}
        </p>
        <p className="mt-1 truncate font-mono text-[11px] text-foreground/40">
          {meta} · {relativeTime(artifact.updatedAt)}
        </p>
      </div>
    </Link>
  );
}

export function ArtifactBrowser({
  kicker,
  title,
  pathLabel,
  description,
  artifacts,
  scope,
  emptyTitle,
  emptyHint,
  previewContent
}: {
  kicker: string;
  title: string;
  pathLabel: string;
  description?: string | null;
  artifacts: ArtifactOwnerSummary[];
  scope: "workspace" | "project";
  emptyTitle: string;
  emptyHint: string;
  previewContent?: Record<string, string>;
}) {
  const count = artifacts.length;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 pb-24 pt-16 sm:px-10 lg:pt-12">
      <header className="mb-8 border-b border-[var(--wb-line)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/40">{kicker}</p>
        <h1 className="mt-2">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-foreground/45">
          <span>{pathLabel}</span>
          <span aria-hidden className="text-foreground/20">·</span>
          <span className="tabular-nums">
            {count} artifact{count === 1 ? "" : "s"}
          </span>
        </div>
        {description ? <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-foreground/55">{description}</p> : null}
      </header>

      {count === 0 ? (
        <div className="mx-auto mt-10 max-w-md text-center">
          <h2 className="font-pixel text-lg text-foreground/85">{emptyTitle}</h2>
          <p className="mt-3 text-sm leading-relaxed text-foreground/50">{emptyHint}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-5 gap-y-7">
          {artifacts.map((artifact) => (
            <li key={artifact.id}>
              <ArtifactTile
                artifact={artifact}
                showProject={scope === "workspace"}
                previewContent={previewContent?.[artifact.id]}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
