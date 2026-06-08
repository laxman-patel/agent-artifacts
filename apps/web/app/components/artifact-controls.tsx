"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, ChevronRight, SlidersHorizontal } from "lucide-react";

type Version = { id: string; versionNumber: number; changelog: string | null; createdAt: string };
type Access = { publicView: boolean; publicEdit: boolean; viewerEmails: string[] };

// Compact, glance-able age. Falls back to a date past a week so the label
// never grows unbounded inside the narrow panel.
function ago(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1 pt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-[var(--wb-line)]" />;
}

function DeepLink({ href, icon: Icon, label }: { href: string; icon: typeof Activity; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      <Icon className="size-3.5 shrink-0 text-foreground/45" />
      <span className="flex-1 text-[13px] leading-tight">{label}</span>
      <ChevronRight className="size-3.5 shrink-0 text-foreground/30" />
    </Link>
  );
}

function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] leading-tight text-foreground/85">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-tight text-foreground/40">{hint}</span>
      </span>
      <span
        aria-hidden
        data-on={checked}
        className="relative h-[18px] w-[30px] shrink-0 rounded-full bg-foreground/15 transition-colors duration-200 data-[on=true]:bg-[var(--wb-accent-jsx)]"
      >
        <span
          className="absolute left-[2px] top-[2px] size-[14px] rounded-full bg-white transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: checked ? "translateX(12px)" : "translateX(0)" }}
        />
      </span>
    </button>
  );
}

export function ArtifactControls({
  artifactId,
  base,
  active,
  onNavigate
}: {
  artifactId: string;
  base: string;
  active: boolean;
  onNavigate: () => void;
}) {
  const started = useRef(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [manager, setManager] = useState<boolean | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [saving, setSaving] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || started.current) return;
    started.current = true;

    void fetch(`/api/artifacts/${artifactId}/versions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { versions: Version[] } | null) => setVersions(d?.versions ?? []))
      .catch(() => setVersions([]));

    void fetch(`/api/artifacts/${artifactId}/access`, { credentials: "include" })
      .then(async (r) => {
        if (r.ok) {
          const d = (await r.json()) as Access;
          setManager(true);
          setAccess(d);
        } else {
          setManager(false);
        }
      })
      .catch(() => setManager(false));
  }, [active, artifactId]);

  async function patchAccess(patch: Partial<Access>) {
    if (!access) return;
    const previous = access;
    const next = { ...access, ...patch };
    setAccess(next);
    setSaving(true);
    setAccessError(null);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/access`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          publicView: next.publicView,
          publicEdit: next.publicEdit,
          viewerEmails: next.viewerEmails
        })
      });
      if (!res.ok) {
        setAccess(previous);
        setAccessError("Could not save");
      }
    } catch {
      setAccess(previous);
      setAccessError("Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SectionLabel>History</SectionLabel>
      {versions === null ? (
        <div className="space-y-1 px-2 py-1">
          <div className="wb-skeleton h-5 rounded" />
          <div className="wb-skeleton h-5 w-3/4 rounded" />
        </div>
      ) : versions.length === 0 ? (
        <p className="px-2 py-1 text-[12px] text-foreground/40">No version history.</p>
      ) : (
        <div className="wb-scroll max-h-44 overflow-y-auto">
          {versions.map((version, index) => (
            <Link
              key={version.id}
              href={index === 0 ? base : `${base}?version=${version.versionNumber}`}
              onClick={onNavigate}
              title={index === 0 ? "Current version" : `View version ${version.versionNumber}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-foreground/[0.06]"
            >
              <span aria-hidden className="grid w-1.5 shrink-0 place-items-center">
                {index === 0 ? (
                  <span className="size-1.5 rounded-full" style={{ background: "var(--wb-accent-jsx)" }} />
                ) : null}
              </span>
              <span className="font-mono text-[11px] text-foreground/70">v{version.versionNumber}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/50">
                {version.changelog ?? ""}
              </span>
              <span className="shrink-0 font-mono text-[10px] text-foreground/35">{ago(version.createdAt)}</span>
            </Link>
          ))}
        </div>
      )}

      {manager ? (
        <>
          <Divider />
          <div className="flex items-center justify-between pr-1">
            <SectionLabel>Access</SectionLabel>
            {saving ? <span className="font-mono text-[9px] text-foreground/35">saving…</span> : null}
            {accessError ? <span className="font-mono text-[9px] text-[oklch(0.7_0.13_25)]">{accessError}</span> : null}
          </div>
          {access ? (
            <>
              <Switch
                label="Public view"
                hint="Anyone with the link can read"
                checked={access.publicView}
                onChange={(next) => void patchAccess({ publicView: next })}
                disabled={saving}
              />
              <Switch
                label="Public edit"
                hint="Anonymous editors allowed"
                checked={access.publicEdit}
                onChange={(next) => void patchAccess({ publicEdit: next })}
                disabled={saving}
              />
              {!access.publicView && access.viewerEmails.length > 0 ? (
                <p className="px-2 pb-1 pt-0.5 text-[11px] text-foreground/40">
                  Shared with {access.viewerEmails.length} {access.viewerEmails.length === 1 ? "person" : "people"}
                </p>
              ) : null}
            </>
          ) : (
            <div className="space-y-1 px-2 py-1">
              <div className="wb-skeleton h-7 rounded" />
              <div className="wb-skeleton h-7 rounded" />
            </div>
          )}

          <Divider />
          <DeepLink href={`${base}/settings`} icon={SlidersHorizontal} label="Sharing & viewers" />
          <DeepLink href={`${base}/audit`} icon={Activity} label="Activity log" />
        </>
      ) : null}
    </div>
  );
}
