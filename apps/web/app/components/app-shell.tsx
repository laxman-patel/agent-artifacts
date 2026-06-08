import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  cookieHeader,
  fetchProfileMe,
  fetchWorkspaceArtifacts,
  fetchWorkspaceProjects,
  fetchWorkspaces
} from "../../lib/server-api";
import { DashboardShell } from "../dashboard/components/dashboard-shell";

export async function AppShell({
  children,
  selectedWorkspaceSlug,
  loginNext
}: {
  children: ReactNode;
  selectedWorkspaceSlug?: string;
  loginNext: string;
}) {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);

  if (!workspacesResult.ok && (workspacesResult.status === 401 || workspacesResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(loginNext)}`);
  }

  if (!workspacesResult.ok) {
    throw new Error(workspacesResult.message ?? "Teams could not be loaded.");
  }

  const workspaces = workspacesResult.body.workspaces;
  const selectedWorkspace =
    (selectedWorkspaceSlug
      ? workspaces.find((candidate) => candidate.slug.toLowerCase() === selectedWorkspaceSlug.toLowerCase())
      : undefined) ??
    workspaces.find((candidate) => candidate.kind === "personal") ??
    workspaces[0];

  if (!selectedWorkspace) {
    redirect("/settings/account");
  }

  const [projectsResult, artifactsResult, profileResult] = await Promise.all([
    fetchWorkspaceProjects(selectedWorkspace.id, header),
    fetchWorkspaceArtifacts(selectedWorkspace.id, header),
    fetchProfileMe(header)
  ]);

  if (!projectsResult.ok) {
    throw new Error(projectsResult.message ?? `Projects could not be loaded (HTTP ${projectsResult.status}).`);
  }

  if (!artifactsResult.ok) {
    throw new Error(artifactsResult.message ?? `Artifacts could not be loaded (HTTP ${artifactsResult.status}).`);
  }

  return (
    <DashboardShell
      workspaces={workspaces}
      workspace={selectedWorkspace}
      projects={[...projectsResult.body.projects].sort((a, b) => a.title.localeCompare(b.title))}
      artifacts={artifactsResult.body.artifacts.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )}
      profile={profileResult.ok ? profileResult.body : null}
    >
      {children}
    </DashboardShell>
  );
}
