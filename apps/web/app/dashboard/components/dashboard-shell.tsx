"use client";

import { PanelLeft } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ProfileMeResponse, ProjectSummary, WorkspaceSummary } from "../../../lib/server-api";
import { DashboardSidebar } from "./dashboard-sidebar";

const STORAGE_KEY = "wb:sidebar-collapsed";

export function DashboardShell({
  workspaces,
  workspace,
  projects,
  profile,
  children
}: {
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary;
  projects: ProjectSummary[];
  profile: ProfileMeResponse | null;
  children: ReactNode;
}) {
  // Two independent intents: a persisted desktop collapse and a transient
  // mobile overlay. Default state matches the server render (expanded desktop,
  // closed mobile); the stored preference is applied after mount.
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  function openMobileSidebar() {
    setMobileOpen(true);
  }

  function collapseDesktopSidebar() {
    setCollapsed(true);
    window.localStorage.setItem(STORAGE_KEY, "1");
  }

  function expandDesktopSidebar() {
    setCollapsed(false);
    window.localStorage.setItem(STORAGE_KEY, "0");
  }

  return (
    <div className="workbench dark relative flex min-h-dvh text-foreground">
      <button
        type="button"
        aria-label="Close sidebar"
        tabIndex={mobileOpen ? 0 : -1}
        data-open={mobileOpen}
        onClick={closeMobileSidebar}
        className="fixed inset-0 z-30 bg-black/55 opacity-0 transition-opacity duration-200 data-[open=false]:pointer-events-none data-[open=true]:opacity-100 lg:hidden"
      />

      <aside
        data-collapsed={collapsed}
        data-mobile-open={mobileOpen}
        className="group/sidebar fixed inset-y-0 left-0 z-40 flex w-[16.5rem] -translate-x-full flex-col border-r border-[var(--wb-line)] bg-[var(--wb-sidebar)] transition-transform duration-200 ease-out data-[mobile-open=true]:translate-x-0 lg:static lg:z-auto lg:translate-x-0 lg:transition-[width] lg:duration-200 lg:data-[collapsed=true]:w-0 lg:data-[collapsed=true]:overflow-hidden lg:data-[collapsed=true]:border-r-0"
      >
        <DashboardSidebar
          workspaces={workspaces}
          workspace={workspace}
          projects={projects}
          profile={profile}
          onCollapse={collapseDesktopSidebar}
          onNavigate={closeMobileSidebar}
        />
      </aside>

      <button
        type="button"
        onClick={openMobileSidebar}
        aria-label="Open sidebar"
        className="fixed left-3 top-3 z-30 inline-flex size-9 items-center justify-center rounded-md border border-[var(--wb-line-strong)] bg-[var(--wb-tile)]/85 text-foreground/70 backdrop-blur-sm transition-colors hover:border-foreground/30 hover:text-foreground lg:hidden"
      >
        <PanelLeft className="size-4" />
      </button>

      <button
        type="button"
        onClick={expandDesktopSidebar}
        aria-label="Open sidebar"
        data-collapsed={collapsed}
        className="fixed left-3 top-3 z-30 hidden size-9 items-center justify-center rounded-md border border-[var(--wb-line-strong)] bg-[var(--wb-tile)]/85 text-foreground/70 backdrop-blur-sm transition-colors hover:border-foreground/30 hover:text-foreground data-[collapsed=true]:lg:inline-flex"
      >
        <PanelLeft className="size-4" />
      </button>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--wb-content)]">{children}</div>
    </div>
  );
}
