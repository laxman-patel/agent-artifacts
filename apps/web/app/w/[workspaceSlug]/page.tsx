import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  artifactPath,
  cookieHeader,
  fetchWorkspaceArtifacts,
  fetchWorkspaceProjects,
  projectPath,
  resolveWorkspaceBySlug,
  workspaceSettingsPath
} from "../../../lib/server-api";

export default async function WorkspaceDashboardPage(props: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const workspaceResult = await resolveWorkspaceBySlug(header, workspaceSlug);

  if (!workspaceResult.ok && (workspaceResult.status === 401 || workspaceResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/w/${workspaceSlug}`)}`);
  }

  if (!workspaceResult.ok && workspaceResult.status === 404) {
    notFound();
  }

  if (!workspaceResult.ok) {
    throw new Error(workspaceResult.message ?? "Unexpected workspace response");
  }

  const { workspace } = workspaceResult.body;

  if (workspace.kind === "personal") {
    redirect("/dashboard");
  }

  const [projectsResult, artifactsResult] = await Promise.all([
    fetchWorkspaceProjects(workspace.id, header),
    fetchWorkspaceArtifacts(workspace.id, header)
  ]);

  const projects = projectsResult.ok ? projectsResult.body.projects : [];
  const artifacts = artifactsResult.ok ? artifactsResult.body.artifacts : [];
  const loadWarnings: string[] = [];

  if (!projectsResult.ok) {
    loadWarnings.push(projectsResult.message ?? "Projects could not be loaded.");
  }

  if (!artifactsResult.ok) {
    loadWarnings.push(artifactsResult.message ?? "Artifacts could not be loaded.");
  }

  const artifactsByProject = new Map<string, typeof artifacts>();
  for (const artifact of artifacts) {
    const list = artifactsByProject.get(artifact.projectId) ?? [];
    list.push(artifact);
    artifactsByProject.set(artifact.projectId, list);
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Team workspace</p>
          <h1>{workspace.name}</h1>
          <p className="subtle">/{workspace.slug} · your role: {workspace.role}</p>
        </div>
        <Link className="ghost-button" href={workspaceSettingsPath(workspace)}>
          Team settings
        </Link>
      </header>

      {loadWarnings.length > 0 ? (
        <section className="card flat">
          <p className="muted">{loadWarnings.join(" ")}</p>
        </section>
      ) : null}

      {projects.length === 0 ? (
        <section className="card flat">
          <p className="muted">No projects yet. Create one via the HTTP API or MCP.</p>
        </section>
      ) : (
        projects.map((project) => {
          const projectArtifacts = artifactsByProject.get(project.id) ?? [];

          return (
            <section className="card flat" key={project.id}>
              <header className="inline-header">
                <div>
                  <Link href={projectPath(project)}>
                    <h2>{project.title}</h2>
                  </Link>
                  <p className="muted small">{projectPath(project)}</p>
                </div>
              </header>

              {projectArtifacts.length === 0 ? (
                <p className="muted">No artifacts in this project.</p>
              ) : (
                <ul className="artifact-list">
                  {projectArtifacts.map((artifact) => (
                    <li key={artifact.id}>
                      <div>
                        <Link href={artifactPath(artifact)}>
                          <strong>{artifact.title}</strong>
                        </Link>
                        <p className="muted small">
                          {artifact.type} · {artifactPath(artifact)}
                        </p>
                      </div>
                      <div className="row-actions">
                        <Link href={`${artifactPath(artifact)}/history`}>History</Link>
                        <Link href={`${artifactPath(artifact)}/settings`}>Access</Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
