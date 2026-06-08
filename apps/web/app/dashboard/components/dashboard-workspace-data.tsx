"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ArtifactOwnerSummary, ProjectSummary, WorkspaceSummary } from "../../../lib/server-api";

interface DashboardWorkspaceData {
  workspace: WorkspaceSummary;
  projects: ProjectSummary[];
  artifacts: ArtifactOwnerSummary[];
}

const DashboardWorkspaceContext = createContext<DashboardWorkspaceData | null>(null);

export function DashboardWorkspaceProvider({
  workspace,
  projects,
  artifacts,
  children
}: DashboardWorkspaceData & {
  children: ReactNode;
}) {
  return (
    <DashboardWorkspaceContext.Provider value={{ workspace, projects, artifacts }}>
      {children}
    </DashboardWorkspaceContext.Provider>
  );
}

export function useDashboardWorkspace() {
  const context = useContext(DashboardWorkspaceContext);
  if (!context) {
    throw new Error("useDashboardWorkspace must be used within DashboardWorkspaceProvider");
  }
  return context;
}
