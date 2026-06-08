"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hash, LayoutGrid, PanelLeftClose, type LucideIcon } from "lucide-react";
import type { ProfileMeResponse, ProjectSummary, WorkspaceSummary } from "../../../lib/server-api";
import { AccountMenu } from "./account-menu";
import { WorkspaceSwitcher } from "./workspace-switcher";

function SidebarLink({
  href,
  icon: Icon,
  label,
  active,
  onNavigate
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      data-active={active}
      className="group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground/65 transition-colors hover:bg-foreground/[0.05] hover:text-foreground/90 data-[active=true]:bg-foreground/[0.08] data-[active=true]:text-foreground"
    >
      <Icon className="size-4 shrink-0 text-foreground/40 transition-colors group-hover:text-foreground/65 group-data-[active=true]:text-foreground/80" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function DashboardSidebar({
  workspaces,
  workspace,
  projects,
  profile,
  onCollapse,
  onNavigate
}: {
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary;
  projects: ProjectSummary[];
  profile: ProfileMeResponse | null;
  onCollapse: () => void;
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  const home = `/dashboard/${workspace.slug}`;

  return (
    <div className="flex h-full w-[16.5rem] flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--wb-line)] px-3">
        <Link href="/" aria-label="Artifacts home" className="flex items-center gap-2">
          <img src="/brand/artifacts-logo.svg" alt="" className="size-[17px]" />
          <span className="font-mono text-[12px] font-semibold uppercase leading-none tracking-[0.05em] text-foreground/90">
            Artifacts
          </span>
        </Link>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="grid size-7 place-items-center rounded-md text-foreground/45 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/80"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <nav className="wb-scroll flex-1 overflow-y-auto px-2 py-3" aria-label="Workspace">
        <SidebarLink
          href={home}
          icon={LayoutGrid}
          label="All artifacts"
          active={pathname === home}
          onNavigate={onNavigate}
        />

        <div className="mb-1 mt-5 flex items-center justify-between px-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/35">Projects</span>
          <span className="font-mono text-[10px] tabular-nums text-foreground/30">{projects.length}</span>
        </div>

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
                  />
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
