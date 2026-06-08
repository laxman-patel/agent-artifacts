import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  cookieHeader,
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

  const [projectsResult, profileResult] = await Promise.all([
    fetchWorkspaceProjects(workspace.id, header),
    fetchProfileMe(header)
  ]);

  const projects = projectsResult.ok ? projectsResult.body.projects : [];
  const sortedProjects = [...projects].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <DashboardShell
      workspaces={workspacesResult.body.workspaces}
      workspace={workspace}
      projects={sortedProjects}
      profile={profileResult.ok ? profileResult.body : null}
    >
      {props.children}
    </DashboardShell>
  );
}
