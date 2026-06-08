"use client";

import { PanelLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ArtifactOwnerSummary, ProfileMeResponse, ProjectSummary, WorkspaceSummary } from "../../../lib/server-api";
import { DashboardSidebar } from "./dashboard-sidebar";
import { DashboardWorkspaceProvider } from "./dashboard-workspace-data";

export function DashboardShell({
  workspaces,
  workspace,
  projects,
  artifacts,
  profile,
  children
}: {
  workspaces: WorkspaceSummary[];
  workspace: WorkspaceSummary;
  projects: ProjectSummary[];
  artifacts: ArtifactOwnerSummary[];
  profile: ProfileMeResponse | null;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileSidebar() {
    setMobileOpen(false);
  }

  function openMobileSidebar() {
    setMobileOpen(true);
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
        data-mobile-open={mobileOpen}
        className="fixed inset-y-0 left-0 z-40 flex w-[16.5rem] -translate-x-full flex-col border-r border-[var(--wb-line)] bg-[var(--wb-sidebar)] transition-transform duration-200 ease-out data-[mobile-open=true]:translate-x-0 lg:static lg:z-auto lg:translate-x-0"
      >
        <DashboardSidebar
          workspaces={workspaces}
          workspace={workspace}
          projects={projects}
          profile={profile}
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

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--wb-content)]">
        <DashboardWorkspaceProvider workspace={workspace} projects={projects} artifacts={artifacts}>
          {children}
        </DashboardWorkspaceProvider>
      </div>
    </div>
  );
}
