import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  cookieHeader,
  fetchWorkspaceArtifacts,
  fetchWorkspaceProjects,
  fetchWorkspaces,
  projectPath
} from "../../../../../lib/server-api";
import { ArtifactBrowser } from "../../../components/artifact-browser";

export default async function ProjectDashboardPage(props: {
  params: Promise<{ workspaceSlug: string; projectSlug: string }>;
}) {
  const { workspaceSlug, projectSlug } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspacesResult = await fetchWorkspaces(header);

  if (!workspacesResult.ok && (workspacesResult.status === 401 || workspacesResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/dashboard/${workspaceSlug}/p/${projectSlug}`)}`);
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

  const [projectsResult, artifactsResult] = await Promise.all([
    fetchWorkspaceProjects(workspace.id, header),
    fetchWorkspaceArtifacts(workspace.id, header)
  ]);

  if (!projectsResult.ok) {
    throw new Error(projectsResult.message ?? `Projects could not be loaded (HTTP ${projectsResult.status}).`);
  }

  if (!artifactsResult.ok) {
    throw new Error(artifactsResult.message ?? `Artifacts could not be loaded (HTTP ${artifactsResult.status}).`);
  }

  const project = projectsResult.body.projects.find((candidate) => candidate.slug.toLowerCase() === projectSlug.toLowerCase());

  if (!project) {
    notFound();
  }

  const artifacts = artifactsResult.body.artifacts
    .filter((artifact) => artifact.projectId === project.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <ArtifactBrowser
      kicker="Project"
      title={project.title}
      pathLabel={projectPath(project)}
      description={project.description}
      artifacts={artifacts}
      scope="project"
      emptyTitle="No artifacts in this project"
      emptyHint={`Publish into ${projectPath(project)} to collect versioned artifacts under this namespace.`}
    />
  );
}
