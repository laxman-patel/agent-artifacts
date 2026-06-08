"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, Copy, FileText } from "lucide-react";
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
  versionLabel,
  workspaceSlug,
  updatedLabel,
  ownerUsername,
  projectSlug,
  publicView
}: {
  title: string;
  type: ArtifactType;
  base: string;
  artifactId: string;
  versionLabel: string;
  workspaceSlug: string;
  updatedLabel: string | null;
  ownerUsername: string;
  projectSlug: string;
  publicView: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}${base}`;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [base]);

  return (
    <div
      ref={ref}
      data-open={open}
      className="workbench dark fixed left-2 top-2 z-50 w-fit max-w-[calc(100vw-1rem)] opacity-[0.72] transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100 data-[open=true]:opacity-100"
    >
      <div
        data-open={open}
        className="inline-flex max-w-full items-center gap-1.5 rounded-[0.35rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile)]/88 p-0.5 pr-1 shadow-[0_8px_22px_oklch(0.08_0_0/0.42)] backdrop-blur-sm data-[open=true]:border-[color-mix(in_oklch,var(--wb-accent-orange)_36%,var(--wb-line-strong))]"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="grid size-7 shrink-0 place-items-center rounded-[0.25rem] text-foreground/55 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
        </button>

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 max-w-[min(235px,calc(100vw-4.5rem))] items-center gap-2 rounded-[0.25rem] px-1.5 py-1 text-left transition-colors hover:bg-foreground/[0.05]"
        >
          <span
            aria-hidden
            className="h-5 w-0.5 shrink-0 rounded-full"
            style={{ background: "var(--wb-accent-orange)" }}
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium leading-tight text-foreground/90">{title}</span>
            <span className="truncate font-mono text-[10px] leading-tight text-foreground/45">
              {TYPE_LABEL[type]} · {versionLabel}
            </span>
          </span>
          <ChevronDown
            data-open={open}
            className="wb-control-chevron size-3.5 shrink-0 text-foreground/40"
          />
        </button>
      </div>

      {open ? (
        <div
          data-open="true"
          role="region"
          aria-label="Artifact details"
          className="wb-control-panel wb-scroll absolute left-0 top-full mt-1.5 w-[min(310px,calc(100vw-1rem))] max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-[0.35rem] border border-[color-mix(in_oklch,var(--wb-accent-orange)_26%,var(--wb-line-strong))] bg-[var(--wb-tile-raised)]/96 p-2 shadow-[0_16px_38px_oklch(0.08_0_0/0.52)]"
        >
          <section className="rounded-[0.25rem] border border-[var(--wb-line)] bg-foreground/[0.025] p-2">
            <div className="mb-2 flex items-center gap-2 text-foreground/88">
              <FileText className="size-3.5 text-[var(--wb-accent-orange)]" />
              <h2 className="text-[13px] font-semibold leading-none">Artifact details</h2>
            </div>
            <dl className="space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.12em] text-foreground/32">Path</dt>
                <dd className="min-w-0 truncate text-right text-foreground/58">{base}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.12em] text-foreground/32">Owner</dt>
                <dd className="truncate text-right text-foreground/58">{ownerUsername}/{projectSlug}</dd>
              </div>
              {updatedLabel ? (
                <div className="flex items-center justify-between gap-3">
                  <dt className="uppercase tracking-[0.12em] text-foreground/32">Updated</dt>
                  <dd className="text-right text-foreground/58">{updatedLabel}</dd>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <dt className="uppercase tracking-[0.12em] text-foreground/32">State</dt>
                <dd className="text-right text-foreground/58">{publicView ? "Public view" : "Restricted"}</dd>
              </div>
            </dl>
          </section>

          <div className="my-1 h-px bg-[var(--wb-line)]" />

          <div className="flex items-center gap-1.5 rounded-[0.25rem] border border-[var(--wb-line)] bg-foreground/[0.025] px-2 py-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/60">{base}</code>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy link"
              className="grid size-6 shrink-0 place-items-center rounded-[0.25rem] text-foreground/55 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
            >
              {copied ? <Check className="size-3.5 text-[var(--wb-accent-orange)]" /> : <Copy className="size-3.5" />}
            </button>
          </div>

          <ArtifactControls
            artifactId={artifactId}
            base={base}
            title={title}
            workspaceSlug={workspaceSlug}
            active={open}
            onNavigate={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
