"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Hash, LayoutGrid, Plus, type LucideIcon } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import type { ProfileMeResponse, ProjectSummary, WorkspaceSummary } from "../../../lib/server-api";
import { AccountMenu } from "./account-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

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
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground/65 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/90 data-[active=true]:bg-[color-mix(in_oklch,var(--wb-accent-orange)_10%,transparent)] data-[active=true]:text-foreground"
    >
      {children ?? <Icon className="size-4 shrink-0 text-foreground/40 transition-colors group-hover:text-foreground/65 group-data-[active=true]:text-[var(--wb-accent-orange)]" />}
      <span className="truncate">{label}</span>
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

function ProjectGlyph({ project }: { project: ProjectSummary }) {
  if (project.icon) {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-[0.25rem] bg-foreground/[0.05] text-[11px] text-[var(--wb-accent-orange)]">
        {project.icon}
      </span>
    );
  }

  return <Hash className="size-4 shrink-0 text-foreground/40 transition-colors group-hover:text-foreground/65 group-data-[active=true]:text-[var(--wb-accent-orange)]" />;
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
  const [projectIcon, setProjectIcon] = useState("✦");
  const [projectPending, setProjectPending] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = projectTitle.trim();
    if (!title) return;

    setProjectPending(true);
    setProjectError(null);
    const slug = slugify(title);

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

      setProjectTitle("");
      setProjectIcon("✦");
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

        <div className="mb-1 mt-5 flex items-center justify-between px-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">Projects</span>
          <button
            type="button"
            aria-label="Create project"
            onClick={() => setCreatingProject((value) => !value)}
            className="grid size-5 place-items-center rounded-[0.25rem] text-foreground/35 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/80"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {creatingProject ? (
          <form className="mb-2 rounded-md border border-[var(--wb-line)] bg-foreground/[0.025] p-2" onSubmit={(event) => void createProject(event)}>
            <div className="flex items-center gap-1.5">
              <input
                aria-label="Project icon"
                className="h-7 w-8 rounded-[0.25rem] border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] text-center text-[13px] text-foreground/85 outline-none"
                maxLength={2}
                onChange={(event) => setProjectIcon(event.target.value)}
                value={projectIcon}
              />
              <input
                autoFocus
                aria-label="Project name"
                className="h-7 min-w-0 flex-1 rounded-[0.25rem] border border-[var(--wb-line-strong)] bg-[var(--wb-canvas)] px-2 text-[12px] text-foreground/85 outline-none placeholder:text-foreground/25"
                onChange={(event) => setProjectTitle(event.target.value)}
                placeholder="Project name"
                value={projectTitle}
              />
            </div>
            {projectError ? <p className="mt-1 text-[11px] text-[var(--wb-accent-orange)]">{projectError}</p> : null}
            <div className="mt-1.5 flex justify-end gap-1">
              <button
                type="button"
                onClick={() => {
                  setCreatingProject(false);
                  setProjectError(null);
                }}
                className="rounded-[0.25rem] px-2 py-1 text-[11px] text-foreground/45 transition-colors hover:text-foreground/80"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={projectPending || projectTitle.trim().length === 0}
                className="rounded-[0.25rem] border border-[var(--wb-line-strong)] px-2 py-1 text-[11px] text-foreground/75 transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
              >
                {projectPending ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
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
