"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useDismiss } from "../../lib/use-dismiss";
import { ArtifactControls } from "./artifact-controls";

type ArtifactType = "html" | "md" | "jsx";

const TYPE_LABEL: Record<ArtifactType, string> = {
  html: "HTML",
  md: "Markdown",
  jsx: "JSX"
};

export function ArtifactControlMenu({
  title,
  type,
  base,
  artifactId,
  viewedVersion,
  workspaceSlug,
  publicView
}: {
  title: string;
  type: ArtifactType;
  base: string;
  artifactId: string;
  viewedVersion: number | null;
  workspaceSlug: string;
  publicView: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPublic, setIsPublic] = useState(publicView);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const versionLabel = viewedVersion ? `v${viewedVersion}` : "latest";
  const visibilityLabel = isPublic ? "Public" : "Restricted";

  return (
    <div
      ref={ref}
      data-open={open}
      className="workbench dark fixed left-2 top-2 z-50 w-fit max-w-[calc(100vw-1rem)] opacity-[0.72] transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 data-[open=true]:opacity-100"
    >
      {/* The pill doubles as the panel header: title and live metadata stay
          visible above the open panel, so the panel never repeats them. */}
      <div className="inline-flex max-w-full items-center rounded-[0.4rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile)]/88 p-0.5 pr-1 shadow-[0_8px_22px_oklch(0.08_0_0/0.42)] backdrop-blur-sm">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="grid size-7 shrink-0 place-items-center rounded-[0.3rem] text-foreground/55 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
        </button>

        <span aria-hidden className="mx-1 h-4 w-px shrink-0 bg-[var(--wb-line)]" />

        <button
          type="button"
          aria-expanded={open}
          data-open={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 max-w-[min(250px,calc(100vw-5.5rem))] items-center gap-2 rounded-[0.3rem] px-2 py-1 text-left transition-colors hover:bg-foreground/[0.05]"
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium leading-tight text-foreground/90">{title}</span>
            <span className="truncate font-mono text-[10px] leading-tight text-foreground/45">
              {TYPE_LABEL[type]} · {versionLabel} · {visibilityLabel}
            </span>
          </span>
          <ChevronDown className="wb-control-chevron size-3.5 shrink-0 text-foreground/40" />
        </button>
      </div>

      {open ? (
        <div
          data-open="true"
          role="region"
          aria-label="Artifact menu"
          className="wb-control-panel wb-scroll absolute left-0 top-full mt-1.5 max-h-[calc(100dvh-4rem)] w-[min(320px,calc(100vw-1rem))] overflow-y-auto rounded-[0.4rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] p-2 shadow-[0_16px_38px_oklch(0.08_0_0/0.52)]"
        >
          <ArtifactControls
            artifactId={artifactId}
            base={base}
            title={title}
            viewedVersion={viewedVersion}
            workspaceSlug={workspaceSlug}
            publicView={publicView}
            onNavigate={() => setOpen(false)}
            onPublicViewChange={setIsPublic}
          />
        </div>
      ) : null}
    </div>
  );
}
