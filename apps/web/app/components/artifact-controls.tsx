"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  Globe,
  History,
  Link2,
  Lock,
  Plus,
  Settings,
  Trash2,
  type LucideIcon
} from "lucide-react";
import { readApiFormError, type ApiFormError } from "../../lib/api-error";
import { FormErrorMessage } from "./form-error-message";

type Version = { id: string; versionNumber: number; changelog: string | null; createdAt: string };
type Access = { publicView: boolean; publicEdit: boolean; viewerEmails: string[] };
type ShareLink = { id: string; role: string; createdAt: string; revokedAt: string | null };

// DESIGN.md reserves the Artifact Rose hue (≈15) as the review/risk accent,
// used as an alert only when state requires it. Delete qualifies: a readable
// rose for text/icons, a deeper solid for the committed destructive button.
const DANGER = "oklch(0.72 0.12 15)";
const DANGER_SOLID = "oklch(0.55 0.15 15)";

// One row vocabulary for every line in the panel so it reads as one system:
// icon · label · trailing detail, identical height and hover treatment.
const ROW =
  "flex w-full items-center gap-2.5 rounded-[0.3rem] px-2 py-1.5 text-[13px] text-foreground/72 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/95";
const SELECT =
  "w-full appearance-none rounded-[0.3rem] border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] py-1.5 pr-6 text-[12px] text-foreground/85 outline-none transition-colors hover:border-foreground/25 disabled:opacity-50";

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

function MicroLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2 pb-1.5 pt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">
      {children}
    </p>
  );
}

function Divider() {
  return <div className="my-1.5 h-px bg-[var(--wb-line)]" />;
}

// Internal navigation that leaves the render surface; the arrow signals
// "this takes you somewhere" without claiming a new tab.
function MenuLink({ href, icon: Icon, label, onClick }: { href: string; icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={ROW}>
      <Icon className="size-3.5 shrink-0 text-foreground/45" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowUpRight className="size-3.5 shrink-0 text-foreground/30" />
    </Link>
  );
}

function Disclosure({
  icon: Icon,
  label,
  trailing,
  open,
  onToggle,
  children
}: {
  icon: LucideIcon;
  label: string;
  trailing?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button type="button" aria-expanded={open} data-open={open} onClick={onToggle} className={ROW}>
        <Icon className="size-3.5 shrink-0 text-foreground/45" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {trailing}
        <ChevronDown className="wb-control-chevron size-3.5 shrink-0 text-foreground/35" />
      </button>
      {open ? children : null}
    </div>
  );
}

// Wraps a native select with an optional leading icon and a quiet chevron so
// form controls share one look. The select itself stays native for free
// keyboard and mobile behavior.
function SelectShell({ icon: Icon, className = "", children }: { icon?: LucideIcon; className?: string; children: ReactNode }) {
  return (
    <span className={`relative inline-flex items-center ${className}`}>
      {Icon ? <Icon className="pointer-events-none absolute left-2.5 size-3.5 text-foreground/50" /> : null}
      {children}
      <ChevronDown className="pointer-events-none absolute right-2 size-3 text-foreground/40" />
    </span>
  );
}

export function ArtifactControls({
  artifactId,
  base,
  title,
  viewedVersion,
  workspaceSlug,
  publicView,
  onNavigate,
  onPublicViewChange
}: {
  artifactId: string;
  base: string;
  title: string;
  viewedVersion: number | null;
  workspaceSlug: string;
  publicView: boolean;
  onNavigate: () => void;
  onPublicViewChange: (next: boolean) => void;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [manager, setManager] = useState<boolean | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [saving, setSaving] = useState(false);
  const [accessError, setAccessError] = useState<ApiFormError | null>(null);

  const [shareLinks, setShareLinks] = useState<ShareLink[] | null>(null);
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("viewer");
  const [creating, setCreating] = useState(false);
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedArtifactLink, setCopiedArtifactLink] = useState(false);
  const [shareError, setShareError] = useState<ApiFormError | null>(null);

  const [linksOpen, setLinksOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The panel is mounted on open, so fetching on mount means fresh share and
  // version state every time the menu is opened.
  useEffect(() => {
    void fetch(`/api/artifacts/${artifactId}/versions`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { versions: Version[] } | null) => setVersions(d?.versions ?? []))
      .catch(() => setVersions([]));

    void fetch(`/api/artifacts/${artifactId}/access`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          setManager(false);
          return;
        }
        const d = (await r.json()) as Access;
        setManager(true);
        setAccess(d);
        onPublicViewChange(d.publicView);
        const links = await fetch(`/api/artifacts/${artifactId}/share-links`, { credentials: "include" })
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null);
        setShareLinks(((links?.shareLinks ?? []) as ShareLink[]).filter((link) => !link.revokedAt));
      })
      .catch(() => setManager(false));
  }, [artifactId, onPublicViewChange]);

  async function patchAccess(patch: Partial<Access>) {
    if (!access) return;
    const previous = access;
    const next = { ...access, ...patch };
    setAccess(next);
    onPublicViewChange(next.publicView);
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
        onPublicViewChange(previous.publicView);
        setAccessError(await readApiFormError(res, "Could not save"));
      }
    } catch {
      setAccess(previous);
      onPublicViewChange(previous.publicView);
      setAccessError({ message: "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  async function createShareLink() {
    setCreating(true);
    setShareError(null);
    setNewShareUrl(null);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/share-links`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: shareRole })
      });
      if (!res.ok) {
        setShareError(await readApiFormError(res, "Could not create link"));
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string; shareUrl?: string; role?: string };
      if (!body.shareUrl || !body.id) {
        setShareError({ message: "Could not create link" });
        return;
      }
      setNewShareUrl(body.shareUrl);
      setShareLinks((prev) => [
        ...(prev ?? []),
        { id: body.id!, role: body.role ?? shareRole, createdAt: new Date().toISOString(), revokedAt: null }
      ]);
    } catch {
      setShareError({ message: "Could not create link" });
    } finally {
      setCreating(false);
    }
  }

  async function revokeShareLink(id: string) {
    const res = await fetch(`/api/share-links/${id}/revoke`, { method: "POST", credentials: "include" });
    if (res.ok) setShareLinks((prev) => (prev ?? []).filter((link) => link.id !== id));
  }

  // Clipboard API can reject (focus loss, embedded webviews); fall back to a
  // transient textarea so the copy action never fails silently.
  async function copyText(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const node = document.createElement("textarea");
      node.value = text;
      node.setAttribute("readonly", "");
      node.style.position = "fixed";
      node.style.opacity = "0";
      document.body.appendChild(node);
      node.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      node.remove();
      return ok;
    }
  }

  function copyShareUrl() {
    if (!newShareUrl) return;
    void copyText(newShareUrl).then((ok) => {
      if (!ok) return;
      setCopiedShare(true);
      window.setTimeout(() => setCopiedShare(false), 1600);
    });
  }

  function copyArtifactUrl() {
    void copyText(`${window.location.origin}${base}`).then((ok) => {
      if (!ok) return;
      setCopiedArtifactLink(true);
      window.setTimeout(() => setCopiedArtifactLink(false), 1600);
    });
  }

  async function handleDelete() {
    if (confirmText !== title) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/artifacts/${artifactId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setDeleteError(body.message ?? `Delete failed (HTTP ${res.status})`);
        setDeleting(false);
        return;
      }
      onNavigate();
      router.push(`/dashboard/${workspaceSlug}`);
      router.refresh();
    } catch {
      setDeleteError("Delete failed");
      setDeleting(false);
    }
  }

  const currentPublicView = access?.publicView ?? publicView;
  const currentRole = access?.publicEdit ? "editor" : "viewer";
  const AccessIcon = currentPublicView ? Globe : Lock;
  const latest = versions?.[0];

  return (
    <div>
      <MicroLabel>Share</MicroLabel>

      {manager === null || (manager && !access) ? (
        <div className="wb-skeleton h-[34px] rounded-[0.3rem]" />
      ) : manager && access ? (
        <div className="flex items-center gap-1.5">
          <SelectShell icon={AccessIcon} className="min-w-0 flex-1">
            <select
              aria-label="General access"
              disabled={saving}
              value={currentPublicView ? "public" : "restricted"}
              onChange={(event) => {
                const next = event.target.value as "public" | "restricted";
                void patchAccess(next === "public" ? { publicView: true } : { publicView: false, publicEdit: false });
              }}
              className={`${SELECT} pl-8`}
            >
              <option value="public">Anyone with the link</option>
              <option value="restricted">Restricted</option>
            </select>
          </SelectShell>
          {currentPublicView ? (
            <SelectShell className="w-[6.5rem] shrink-0">
              <select
                aria-label="Link role"
                disabled={saving}
                value={currentRole}
                onChange={(event) => {
                  const role = event.target.value as "viewer" | "editor";
                  void patchAccess({ publicView: true, publicEdit: role === "editor" });
                }}
                className={`${SELECT} pl-2.5`}
              >
                <option value="viewer">can view</option>
                <option value="editor">can edit</option>
              </select>
            </SelectShell>
          ) : null}
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-2 py-1.5 text-[13px] text-foreground/75">
          <AccessIcon className="size-3.5 shrink-0 text-foreground/45" />
          <span className="min-w-0 truncate">
            {currentPublicView ? "Anyone with the link can view" : "Restricted to invited people"}
          </span>
        </div>
      )}
      <FormErrorMessage
        error={accessError}
        className="mt-1 px-2 font-mono text-[10px]"
        style={{ color: DANGER }}
      />

      <button
        type="button"
        onClick={copyArtifactUrl}
        className="primary-button mt-1.5 flex w-full items-center justify-center gap-2 rounded-[0.3rem] border px-3 py-1.5 text-[13px] font-medium transition-colors"
      >
        {copiedArtifactLink ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
        <span aria-live="polite">{copiedArtifactLink ? "Link copied" : "Copy link"}</span>
      </button>

      {manager && access ? (
        <div className="mt-1.5">
          <Disclosure
            icon={Link2}
            label="Share links"
            trailing={
              shareLinks && shareLinks.length > 0 ? (
                <span className="shrink-0 font-mono text-[10px] text-foreground/40">{shareLinks.length}</span>
              ) : undefined
            }
            open={linksOpen}
            onToggle={() => setLinksOpen((value) => !value)}
          >
            <div className="mt-0.5 rounded-[0.3rem] bg-foreground/[0.03] p-1">
              {shareLinks === null ? (
                <div className="wb-skeleton h-7 rounded-[0.25rem]" />
              ) : (
                <>
                  {shareLinks.length === 0 && !newShareUrl ? (
                    <p className="px-1.5 py-1 text-[12px] text-foreground/40">
                      Revocable links grant access without changing it for everyone.
                    </p>
                  ) : null}
                  {shareLinks.map((link) => (
                    <div key={link.id} className="flex items-center gap-2 rounded-[0.25rem] px-1.5 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-[12px] capitalize text-foreground/72">{link.role}</span>
                      <span className="shrink-0 font-mono text-[10px] text-foreground/35">{ago(link.createdAt)}</span>
                      <button
                        type="button"
                        onClick={() => void revokeShareLink(link.id)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-foreground/45 transition-colors hover:bg-foreground/[0.08] hover:text-foreground/85"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                  {newShareUrl ? (
                    <div className="m-1 rounded-[0.25rem] border border-[var(--wb-line)] bg-[var(--wb-canvas)] p-1.5">
                      <div className="flex items-center gap-1.5">
                        <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/70">{newShareUrl}</code>
                        <button
                          type="button"
                          onClick={copyShareUrl}
                          aria-label="Copy revocable share link"
                          className="grid size-6 shrink-0 place-items-center rounded text-foreground/55 transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
                        >
                          {copiedShare ? <Check className="size-3.5 text-[var(--wb-accent-orange)]" /> : <Link2 className="size-3.5" />}
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-foreground/42">Copy it now; it won&rsquo;t be shown again.</p>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-1.5 px-1 py-1">
                    <SelectShell className="w-24 shrink-0">
                      <select
                        aria-label="New link role"
                        value={shareRole}
                        onChange={(event) => setShareRole(event.target.value as "viewer" | "editor")}
                        className={`${SELECT} pl-2.5`}
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                      </select>
                    </SelectShell>
                    <button
                      type="button"
                      onClick={() => void createShareLink()}
                      disabled={creating}
                      className="ml-auto flex shrink-0 items-center gap-1 rounded-[0.25rem] border border-[var(--wb-line-strong)] px-2 py-1 text-[12px] text-foreground/70 transition-colors hover:bg-foreground/[0.055] hover:text-foreground/90 disabled:opacity-50"
                    >
                      <Plus className="size-3.5" />
                      {creating ? "Creating…" : "New link"}
                    </button>
                  </div>
                  <FormErrorMessage
                    error={shareError}
                    className="px-1.5 pb-1 text-[11px]"
                    style={{ color: DANGER }}
                  />
                </>
              )}
            </div>
          </Disclosure>
        </div>
      ) : null}

      <Divider />

      <Disclosure
        icon={History}
        label="Versions"
        trailing={
          latest ? (
            <span className="shrink-0 font-mono text-[10px] text-foreground/40">
              v{latest.versionNumber} · {ago(latest.createdAt)}
            </span>
          ) : undefined
        }
        open={versionsOpen}
        onToggle={() => setVersionsOpen((value) => !value)}
      >
        <div className="wb-scroll mt-0.5 max-h-44 overflow-y-auto rounded-[0.3rem] bg-foreground/[0.03] p-1">
          {versions === null ? (
            <div className="space-y-1">
              <div className="wb-skeleton h-6 rounded-[0.25rem]" />
              <div className="wb-skeleton h-6 w-3/4 rounded-[0.25rem]" />
            </div>
          ) : versions.length === 0 ? (
            <p className="px-1.5 py-1 text-[12px] text-foreground/40">No versions yet.</p>
          ) : (
            versions.map((version, index) => {
              const isViewed = viewedVersion ? version.versionNumber === viewedVersion : index === 0;
              return (
                <Link
                  key={version.id}
                  href={index === 0 ? base : `${base}?version=${version.versionNumber}`}
                  onClick={onNavigate}
                  aria-current={isViewed ? "true" : undefined}
                  className={`flex items-center gap-2 rounded-[0.25rem] px-1.5 py-1.5 transition-colors hover:bg-foreground/[0.06] ${isViewed ? "bg-foreground/[0.045]" : ""}`}
                >
                  <span
                    aria-hidden
                    className="size-1 shrink-0 rounded-full"
                    style={{ background: isViewed ? "var(--wb-accent-orange)" : "transparent" }}
                  />
                  <span className={`shrink-0 font-mono text-[11px] ${isViewed ? "text-foreground/90" : "text-foreground/60"}`}>
                    v{version.versionNumber}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/45">
                    {version.changelog ?? (index === 0 ? "Latest version" : "")}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-foreground/35">{ago(version.createdAt)}</span>
                </Link>
              );
            })
          )}
        </div>
      </Disclosure>

      {manager ? (
        <>
          <MenuLink href={`${base}/audit`} icon={Activity} label="Audit log" onClick={onNavigate} />
          <MenuLink href={`${base}/settings`} icon={Settings} label="Artifact settings" onClick={onNavigate} />

          <Divider />

          {confirmingDelete ? (
            <div className="rounded-[0.3rem] p-2" style={{ background: "color-mix(in oklch, oklch(0.6 0.14 15) 8%, transparent)" }}>
              <p className="text-[12px] leading-snug text-foreground/65">
                This permanently deletes the artifact and every version. Type{" "}
                <span className="font-mono text-foreground/90">{title}</span> to confirm.
              </p>
              <input
                autoFocus
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={title}
                className="mt-1.5 w-full appearance-none rounded-[0.25rem] border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] px-2 py-1.5 font-mono text-[12px] text-foreground/90 outline-none placeholder:text-foreground/25"
              />
              <div className="mt-2 flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setConfirmText("");
                    setDeleteError(null);
                  }}
                  className="rounded-[0.25rem] px-2 py-1 text-[12px] text-foreground/55 transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || confirmText !== title}
                  className="rounded-[0.25rem] px-2.5 py-1 text-[12px] font-medium text-white transition-opacity disabled:opacity-40"
                  style={{ background: DANGER_SOLID }}
                >
                  {deleting ? "Deleting…" : "Delete artifact"}
                </button>
              </div>
              {deleteError ? (
                <p className="mt-1 text-[11px]" style={{ color: DANGER }}>
                  {deleteError}
                </p>
              ) : null}
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className={ROW} style={{ color: DANGER }}>
              <Trash2 className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">Delete artifact</span>
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
