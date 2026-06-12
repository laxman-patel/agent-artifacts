"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Boxes,
  Brain,
  Check,
  ChevronDown,
  Code2,
  Database,
  Folder,
  Hash,
  Layers3,
  LayoutGrid,
  Palette,
  PenTool,
  Plus,
  Rocket,
  Sparkles,
  X,
  Zap,
  type LucideIcon
} from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { ProfileMeResponse, ProjectSummary, WorkspaceSummary } from "../../../lib/server-api";
import { AccountMenu } from "./account-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

const PROJECT_ICON_OPTIONS = [
  { id: "folder", label: "Folder", icon: Folder },
  { id: "boxes", label: "Boxes", icon: Boxes },
  { id: "rocket", label: "Rocket", icon: Rocket },
  { id: "sparkle", label: "Sparkle", icon: Sparkles },
  { id: "bolt", label: "Bolt", icon: Zap },
  { id: "code", label: "Code", icon: Code2 },
  { id: "pen", label: "Pen", icon: PenTool },
  { id: "layers", label: "Layers", icon: Layers3 },
  { id: "book", label: "Book", icon: BookOpen },
  { id: "brain", label: "Brain", icon: Brain },
  { id: "data", label: "Data", icon: Database },
  { id: "palette", label: "Palette", icon: Palette }
] as const satisfies readonly { id: string; label: string; icon: LucideIcon }[];

type ProjectIconId = (typeof PROJECT_ICON_OPTIONS)[number]["id"];

const DEFAULT_PROJECT_ICON = PROJECT_ICON_OPTIONS[0];

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
  children
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onNavigate: () => void;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      data-active={active}
      className="group flex h-7 min-w-0 items-center gap-2.5 rounded-md px-2 text-sm leading-none text-foreground/65 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/90 data-[active=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_10%,transparent)] data-[active=true]:text-foreground"
    >
      {children ?? <Icon className="size-4 shrink-0 text-foreground/40 transition-colors group-hover:text-foreground/65 group-data-[active=true]:text-[var(--wb-accent-orange)]" />}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </Link>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function hashString(value: string): number {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function projectIconFromId(iconId: string | null | undefined, fallbackSource: string) {
  const selected = PROJECT_ICON_OPTIONS.find((option) => option.id === iconId);
  if (selected) return selected;
  return PROJECT_ICON_OPTIONS[hashString(fallbackSource) % PROJECT_ICON_OPTIONS.length] ?? DEFAULT_PROJECT_ICON;
}

function ProjectGlyph({ project }: { project: ProjectSummary }) {
  const Icon = projectIconFromId(project.icon, `${project.title}:${project.slug}`).icon;

  return (
    <div className="grid size-5 shrink-0 place-items-center rounded-[0.3rem] bg-foreground/[0.045] text-foreground/45 transition-colors group-hover:bg-foreground/[0.07] group-hover:text-foreground/70 group-data-[active=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_14%,transparent)] group-data-[active=true]:text-[var(--wb-accent-orange)]">
      <Icon className="size-3.5" aria-hidden="true" />
    </div>
  );
}

export function DashboardSidebar({
  workspaces,
  workspace,
  projects,
  profile,
  onNavigate
}: {
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary;
  projects: ProjectSummary[];
  profile: ProfileMeResponse | null;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const home = `/dashboard/${workspace.slug}`;
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [projectIcon, setProjectIcon] = useState<ProjectIconId>(DEFAULT_PROJECT_ICON.id);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [projectPending, setProjectPending] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const selectedProjectIcon = projectIconFromId(projectIcon, projectTitle || workspace.slug);
  const SelectedProjectIcon = selectedProjectIcon.icon;
  const previewSlug = slugify(projectTitle) || "project-name";

  function resetProjectDialog() {
    setProjectTitle("");
    setProjectIcon(DEFAULT_PROJECT_ICON.id);
    setIconPickerOpen(false);
    setProjectError(null);
  }

  function closeProjectDialog() {
    if (projectPending) return;
    setCreatingProject(false);
    resetProjectDialog();
  }

  useEffect(() => {
    if (!creatingProject) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (iconPickerOpen) {
        setIconPickerOpen(false);
        return;
      }
      closeProjectDialog();
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatingProject, iconPickerOpen, projectPending]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) return;
    const slug = slugify(title);
    if (!slug) {
      setProjectError("Enter a name with at least one letter or number.");
      return;
    }

    setProjectPending(true);
    setProjectError(null);

    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/projects`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, slug, icon: projectIcon })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string; issues?: { message: string }[] };
        setProjectError(body.issues?.[0]?.message ?? body.message ?? "Could not create project.");
        return;
      }

      resetProjectDialog();
      setCreatingProject(false);
      router.refresh();
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setProjectPending(false);
    }
  }

  return (
    <div className="flex h-full w-[16.5rem] flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--wb-line)] px-3">
        <div className="flex items-center gap-2" aria-label="Artifacts">
          <img src="/brand/artifacts-logo.svg" alt="" className="size-[17px]" />
          <span className="font-mono text-[12px] font-semibold uppercase leading-none tracking-[0.05em] text-foreground/90">
            Artifacts
          </span>
        </div>
      </div>

      <nav className="wb-scroll flex-1 overflow-y-auto px-2 py-3" aria-label="Team">
        <SidebarLink
          href={home}
          icon={LayoutGrid}
          label="All artifacts"
          active={pathname === home}
          onNavigate={onNavigate}
        />

        <div className="mb-1 mt-5 grid h-7 grid-cols-[1fr_auto] items-center px-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">Projects</span>
          <button
            type="button"
            aria-label="Create project"
            aria-haspopup="dialog"
            onClick={() => setCreatingProject(true)}
            className="inline-flex size-6 items-center justify-center rounded-[0.35rem] border border-[color-mix(in_oklch,var(--wb-accent-orange)_52%,var(--wb-line-strong))] text-[var(--wb-accent-orange)] transition-colors hover:bg-[color-mix(in_oklch,var(--wb-accent-orange)_12%,transparent)] hover:text-foreground"
          >
            <Plus className="size-3.5" strokeWidth={2.25} />
          </button>
        </div>

        {creatingProject && typeof document !== "undefined"
          ? createPortal(
              <div
                className="wb-modal-scrim dark fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[oklch(0.08_0_0/0.62)] px-4 py-10 text-foreground backdrop-blur-md"
                role="presentation"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeProjectDialog();
                }}
              >
                <form
                  className="wb-modal-card workbench relative w-full max-w-[27rem] rounded-[0.625rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] p-6 text-foreground shadow-[0_30px_90px_oklch(0.05_0_0/0.7)]"
                  onSubmit={(event) => void createProject(event)}
                  onMouseDown={() => setIconPickerOpen(false)}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="create-project-title"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">New project</p>
                      <h2 id="create-project-title" className="mt-2 font-pixel text-[1.5rem] font-normal leading-none tracking-[-0.045em] text-foreground/92">
                        Name your project.
                      </h2>
                    </div>
                    <button
                      type="button"
                      aria-label="Close create project dialog"
                      onClick={closeProjectDialog}
                      className="-mr-1.5 -mt-1.5 inline-flex size-8 items-center justify-center rounded-[0.35rem] text-foreground/40 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-6 flex items-center gap-4">
                    <div className="relative shrink-0" onMouseDown={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        aria-haspopup="menu"
                        aria-expanded={iconPickerOpen}
                        aria-label={`Project icon: ${selectedProjectIcon.label}. Change icon`}
                        onClick={() => setIconPickerOpen((open) => !open)}
                        data-open={iconPickerOpen}
                        className="group relative grid size-[4.75rem] place-items-center rounded-[0.45rem] border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] text-[var(--wb-accent-orange)] transition-colors hover:border-[color-mix(in_oklch,var(--wb-accent-orange)_45%,var(--wb-line-strong))] data-[open=true]:border-[var(--wb-accent-orange)]"
                      >
                        <SelectedProjectIcon className="size-9" strokeWidth={1.75} aria-hidden="true" />
                        <span className="absolute bottom-1 right-1 inline-flex size-4 items-center justify-center rounded-[0.25rem] bg-foreground/[0.08] text-foreground/55 transition-colors group-hover:text-foreground/80">
                          <ChevronDown className="size-3 transition-transform group-data-[open=true]:rotate-180" strokeWidth={2.25} />
                        </span>
                      </button>

                      {iconPickerOpen ? (
                        <div
                          role="menu"
                          aria-label="Choose project icon"
                          className="wb-modal-pop absolute left-0 top-[calc(100%+0.4rem)] z-10 w-[13.5rem] rounded-[0.45rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] p-2 shadow-[0_18px_44px_oklch(0.05_0_0/0.6)]"
                        >
                          <div className="grid grid-cols-4 gap-1.5">
                            {PROJECT_ICON_OPTIONS.map((option) => {
                              const Icon = option.icon;
                              const selected = projectIcon === option.id;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={selected}
                                  aria-label={`${option.label} icon`}
                                  title={option.label}
                                  data-selected={selected}
                                  onClick={() => {
                                    setProjectIcon(option.id);
                                    setIconPickerOpen(false);
                                  }}
                                  className="relative inline-flex aspect-square items-center justify-center rounded-[0.35rem] border border-[var(--wb-line)] bg-[var(--wb-canvas)] text-foreground/72 transition-colors hover:border-foreground/25 hover:text-foreground data-[selected=true]:border-[var(--wb-accent-orange)] data-[selected=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_12%,transparent)] data-[selected=true]:text-[var(--wb-accent-orange)]"
                                >
                                  <Icon className="size-4" aria-hidden="true" />
                                  {selected ? <Check className="absolute right-0.5 top-0.5 size-2.5" strokeWidth={3} aria-hidden="true" /> : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <label className="block">
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Project name</span>
                        <input
                          autoFocus
                          className="input mt-1.5 h-10 w-full rounded-[0.35rem] px-3 text-sm text-foreground/90 placeholder:text-foreground/25"
                          onChange={(event) => setProjectTitle(event.target.value)}
                          placeholder="Browser Flow"
                          value={projectTitle}
                        />
                      </label>
                      <p className="mt-2 truncate font-mono text-[11px] text-foreground/35">
                        <span className="text-foreground/25">{workspace.slug}/</span>
                        <span className="text-foreground/55">{previewSlug}</span>
                      </p>
                    </div>
                  </div>

                  {projectError ? <p className="mt-4 text-[12px] text-[var(--wb-accent-orange)]">{projectError}</p> : null}

                  <div className="mt-6 flex justify-end gap-2 border-t border-[var(--wb-line)] pt-4">
                    <button
                      type="button"
                      onClick={closeProjectDialog}
                      className="inline-flex h-9 items-center justify-center rounded-[0.35rem] px-3 text-[12px] text-foreground/52 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/86"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={projectPending || projectTitle.trim().length === 0}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-none border border-foreground/30 bg-[oklch(0.96_0_0)] px-4 font-pixel text-[13px] font-normal uppercase leading-none tracking-[-0.035em] text-primary-foreground shadow-[inset_0_0_0_1px_oklch(1_0_0_/_0.42),0_1px_0_oklch(1_0_0_/_0.18)] transition-colors hover:bg-[oklch(0.92_0_0)] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {projectPending ? "Creating..." : "Create project"}
                      <Plus className="size-4 text-[var(--wb-accent-orange)]" strokeWidth={2} />
                    </button>
                  </div>
                </form>
              </div>,
              document.body
            )
          : null}

        {projects.length === 0 ? (
          <p className="px-2 py-1.5 text-[13px] leading-relaxed text-foreground/40">
            No projects yet. Publish one with the CLI or MCP to start a namespace.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {projects.map((project) => {
              const href = `${home}/p/${project.slug}`;
              return (
                <li key={project.id}>
                  <SidebarLink
                    href={href}
                    icon={Hash}
                    label={project.title}
                    active={pathname === href}
                    onNavigate={onNavigate}
                  >
                    <ProjectGlyph project={project} />
                  </SidebarLink>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-[var(--wb-line)] p-2">
        <WorkspaceSwitcher workspaces={workspaces} workspace={workspace} />
        {profile ? (
          <AccountMenu profile={profile} workspace={workspace} />
        ) : (
          <Link
            href="/settings/account"
            onClick={onNavigate}
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground/65 transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
          >
            Account settings
          </Link>
        )}
      </div>
    </div>
  );
}
