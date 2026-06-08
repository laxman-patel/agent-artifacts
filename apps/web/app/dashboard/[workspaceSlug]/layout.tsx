import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  cookieHeader,
  fetchWorkspaceArtifacts,
  fetchProfileMe,
  fetchWorkspaceProjects,
  fetchWorkspaces
} from "../../../lib/server-api";
import { DashboardShell } from "../components/dashboard-shell";
import "../../workbench.css";

export default async function DashboardLayout(props: {
  children: ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);

  if (!workspacesResult.ok && (workspacesResult.status === 401 || workspacesResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${workspaceSlug}`)}`);
  }

  if (!workspacesResult.ok) {
    throw new Error(workspacesResult.message ?? "Workspaces could not be loaded.");
  }

  const workspace = workspacesResult.body.workspaces.find(
    (candidate) => candidate.slug.toLowerCase() === workspaceSlug.toLowerCase()
  );

  if (!workspace) {
    notFound();
  }

  const [projectsResult, artifactsResult, profileResult] = await Promise.all([
    fetchWorkspaceProjects(workspace.id, header),
    fetchWorkspaceArtifacts(workspace.id, header),
    fetchProfileMe(header)
  ]);

  if (!projectsResult.ok) {
    throw new Error(projectsResult.message ?? `Projects could not be loaded (HTTP ${projectsResult.status}).`);
  }

  if (!artifactsResult.ok) {
    throw new Error(artifactsResult.message ?? `Artifacts could not be loaded (HTTP ${artifactsResult.status}).`);
  }

  const sortedProjects = [...projectsResult.body.projects].sort((a, b) => a.title.localeCompare(b.title));
  const sortedArtifacts = artifactsResult.body.artifacts.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <DashboardShell
      workspaces={workspacesResult.body.workspaces}
      workspace={workspace}
      projects={sortedProjects}
      artifacts={sortedArtifacts}
      profile={profileResult.ok ? profileResult.body : null}
    >
      {props.children}
    </DashboardShell>
  );
}
