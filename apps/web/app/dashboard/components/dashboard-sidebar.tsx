"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Boxes,
  Brain,
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
import { useState, type FormEvent, type ReactNode } from "react";
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
  const [projectSlug, setProjectSlug] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectIcon, setProjectIcon] = useState<ProjectIconId>(DEFAULT_PROJECT_ICON.id);
  const [projectPending, setProjectPending] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const selectedProjectIcon = projectIconFromId(projectIcon, projectTitle || projectSlug || workspace.slug);
  const SelectedProjectIcon = selectedProjectIcon.icon;

  function resetProjectDialog() {
    setProjectTitle("");
    setProjectSlug("");
    setProjectDescription("");
    setProjectIcon(DEFAULT_PROJECT_ICON.id);
    setProjectError(null);
  }

  function closeProjectDialog() {
    if (projectPending) return;
    setCreatingProject(false);
    resetProjectDialog();
  }

  function updateProjectTitle(value: string) {
    const previousAutoSlug = slugify(projectTitle);
    const nextAutoSlug = slugify(value);
    setProjectTitle(value);
    setProjectSlug((current) => (current.length === 0 || current === previousAutoSlug ? nextAutoSlug : current));
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) return;
    const slug = slugify(projectSlug || title);
    if (!slug) {
      setProjectError("Add a valid project slug.");
      return;
    }
    const description = projectDescription.trim();

    setProjectPending(true);
    setProjectError(null);

    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(workspace.id)}/projects`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          icon: projectIcon,
          description: description.length > 0 ? description : undefined
        })
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

        {creatingProject ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/68 px-4" role="presentation">
            <form
              className="workbench w-full max-w-3xl rounded-[0.7rem] border border-[var(--wb-line-strong)] bg-[var(--wb-tile-raised)] p-5 text-foreground shadow-[0_26px_80px_oklch(0.07_0_0/0.62)]"
              onSubmit={(event) => void createProject(event)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-project-title"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">New project</p>
                  <h2 id="create-project-title" className="mt-2 font-pixel text-[1.65rem] font-normal tracking-[-0.045em] text-foreground/92">
                    Add project details.
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close create project dialog"
                  onClick={closeProjectDialog}
                  className="inline-flex size-8 items-center justify-center rounded-[0.35rem] text-foreground/45 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-5 md:grid-cols-[12rem_1fr]">
                <div className="space-y-3">
                  <div className="grid aspect-square place-items-center rounded-[0.35rem] border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)]">
                    <SelectedProjectIcon className="size-16 text-[var(--wb-accent-orange)]" strokeWidth={1.65} aria-hidden="true" />
                  </div>
                  <p className="text-center font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/38">
                    {selectedProjectIcon.label}
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block space-y-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Project name</span>
                    <input
                      autoFocus
                      className="input h-10 w-full rounded-[0.35rem] px-3 text-sm text-foreground/88 placeholder:text-foreground/25"
                      onChange={(event) => updateProjectTitle(event.target.value)}
                      placeholder="Browser Flow Project"
                      value={projectTitle}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-[1fr_1.35fr]">
                    <label className="block space-y-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Slug</span>
                      <input
                        className="input h-9 w-full rounded-[0.35rem] px-3 font-mono text-[12px] text-foreground/82 placeholder:text-foreground/25"
                        onChange={(event) => setProjectSlug(slugify(event.target.value))}
                        placeholder="browser-flow-project"
                        value={projectSlug}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Description</span>
                      <input
                        className="input h-9 w-full rounded-[0.35rem] px-3 text-[12px] text-foreground/82 placeholder:text-foreground/25"
                        onChange={(event) => setProjectDescription(event.target.value)}
                        placeholder="Short project details"
                        value={projectDescription}
                      />
                    </label>
                  </div>

                  <div className="space-y-2">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-foreground/35">Icon</p>
                    <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
                      {PROJECT_ICON_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-label={`Use ${option.label} icon`}
                            aria-pressed={projectIcon === option.id}
                            data-selected={projectIcon === option.id}
                            onClick={() => setProjectIcon(option.id)}
                            className="inline-flex aspect-square items-center justify-center rounded-[0.35rem] border border-[var(--wb-line)] bg-[var(--wb-canvas)] text-foreground/48 transition-colors hover:border-foreground/24 hover:text-foreground/78 data-[selected=true]:border-[var(--wb-accent-orange)] data-[selected=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_10%,var(--wb-canvas))] data-[selected=true]:text-[var(--wb-accent-orange)]"
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {projectError ? <p className="mt-4 text-[12px] text-[var(--wb-accent-orange)]">{projectError}</p> : null}

              <div className="mt-5 flex justify-end gap-2">
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
                  className="primary-button inline-flex h-9 items-center justify-center gap-2 rounded-[0.35rem] border px-3 font-pixel text-[13px] uppercase tracking-[-0.035em] disabled:cursor-wait disabled:opacity-55"
                >
                  {projectPending ? "Creating..." : "Create project"}
                  <Plus className="size-4" />
                </button>
              </div>
            </form>
          </div>
        ) : null}

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
