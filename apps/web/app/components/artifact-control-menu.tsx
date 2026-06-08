"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  History,
  ShieldHalf
} from "lucide-react";
import { useDismiss } from "../../lib/use-dismiss";

type ArtifactType = "html" | "md" | "jsx";

const ACCENT: Record<ArtifactType, string> = {
  html: "var(--wb-accent-html)",
  md: "var(--wb-accent-md)",
  jsx: "var(--wb-accent-jsx)"
};

const TYPE_LABEL: Record<ArtifactType, string> = {
  html: "HTML",
  md: "Markdown",
  jsx: "JSX"
};

function PanelLink({
  href,
  icon: Icon,
  label,
  hint
}: {
  href: string;
  icon: typeof History;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <Icon className="size-3.5 shrink-0 text-foreground/45" />
      <span className="flex-1 text-[13px] leading-tight">{label}</span>
      <span className="font-mono text-[10px] text-foreground/35">{hint}</span>
    </Link>
  );
}

export function ArtifactControlMenu({
  title,
  type,
  base,
  versionLabel,
  updatedAt
}: {
  title: string;
  type: ArtifactType;
  base: string;
  versionLabel: string;
  updatedAt: string;
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

  const updated = new Date(updatedAt);
  const updatedText = Number.isNaN(updated.getTime())
    ? null
    : updated.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div ref={ref} className="workbench dark fixed left-3 top-3 z-50 w-[min(340px,calc(100vw-1.5rem))]">
      <div
        data-open={open}
        className="flex items-center gap-2 rounded-xl border border-[var(--wb-line-strong)] bg-[var(--wb-tile)]/90 p-1 pr-1.5 shadow-[0_10px_30px_oklch(0.08_0_0/0.5)] backdrop-blur-md"
      >
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-foreground/55 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </button>

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-foreground/[0.05]"
        >
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ background: ACCENT[type] }}
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

      <div
        data-open={open}
        inert={!open}
        role="region"
        aria-label="Artifact details"
        className="wb-control-panel absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] p-1.5 shadow-[0_18px_44px_oklch(0.08_0_0/0.55)]"
      >
        <div className="px-2 pb-2 pt-1.5">
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/60">{base}</code>
            <button
              type="button"
              onClick={copyLink}
              aria-label="Copy link"
              className="grid size-7 shrink-0 place-items-center rounded-md text-foreground/55 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
            >
              {copied ? <Check className="size-3.5 text-[var(--wb-accent-jsx)]" /> : <Copy className="size-3.5" />}
            </button>
          </div>
          {updatedText ? (
            <p className="mt-1.5 font-mono text-[10px] text-foreground/35">Updated {updatedText}</p>
          ) : null}
        </div>

        <div className="my-1 h-px bg-[var(--wb-line)]" />

        <PanelLink href={`${base}/history`} icon={History} label="Version history" hint="versions" />
        <PanelLink href={`${base}/settings`} icon={ShieldHalf} label="Access & sharing" hint="who" />
        <PanelLink href={`${base}/audit`} icon={Activity} label="Activity" hint="log" />
      </div>
    </div>
  );
}
