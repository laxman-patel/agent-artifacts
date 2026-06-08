"use client";

import Link from "next/link";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRef, useState } from "react";
import type { WorkspaceSummary } from "../../../lib/server-api";
import { useDismiss } from "../../../lib/use-dismiss";

function workspaceLabel(workspace: WorkspaceSummary): string {
  return workspace.kind === "personal" ? "Personal" : workspace.name;
}

function monogram(workspace: WorkspaceSummary): string {
  if (workspace.kind === "personal") return "P";
  return (workspace.name || workspace.slug).trim().charAt(0).toUpperCase() || "W";
}

// A small square monogram, the one place a touch of Geist Pixel earns its keep
// in the chrome: a memorable, artifact-native mark rather than decoration.
function Monogram({ workspace, active }: { workspace: WorkspaceSummary; active?: boolean }) {
  return (
    <span
      aria-hidden
      data-active={active}
      className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] font-pixel text-[11px] leading-none text-foreground/70 data-[active=true]:text-foreground"
    >
      {monogram(workspace)}
    </span>
  );
}

export function WorkspaceSwitcher({
  workspaces,
  workspace
}: {
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-md border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] py-1 shadow-[0_14px_36px_oklch(0.08_0_0/0.55)]"
        >
          <p className="px-3 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">
            Workspaces
          </p>
          <div className="wb-scroll max-h-64 overflow-y-auto">
            {workspaces.map((item) => {
              const isCurrent = item.id === workspace.id;
              return (
                <Link
                  key={item.id}
                  role="menuitem"
                  href={`/dashboard/${item.slug}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  <Monogram workspace={item} active={isCurrent} />
                  <span className="min-w-0 flex-1 truncate">{workspaceLabel(item)}</span>
                  {isCurrent ? <Check className="size-3.5 shrink-0 text-foreground/70" /> : null}
                </Link>
              );
            })}
          </div>
          <div className="my-1 h-px bg-[var(--wb-line)]" />
          <Link
            role="menuitem"
            href="/workspaces/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 text-sm text-foreground/65 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-[0.3rem] border border-dashed border-[var(--wb-line-strong)] text-foreground/50">
              <Plus className="size-3.5" />
            </span>
            New workspace
          </Link>
        </div>
      ) : null}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05]"
      >
        <Monogram workspace={workspace} active />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground/90">{workspaceLabel(workspace)}</span>
          <span className="block truncate font-mono text-[10px] text-foreground/40">/{workspace.slug}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-foreground/40" />
      </button>
    </div>
  );
}
