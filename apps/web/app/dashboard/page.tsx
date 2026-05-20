import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  artifactPath,
  cookieHeader,
  fetchOwnedArtifacts,
  fetchOwnedProjects,
  projectPath
} from "../../lib/server-api";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const [projectsResult, artifactsResult] = await Promise.all([
    fetchOwnedProjects(header),
    fetchOwnedArtifacts(header)
  ]);

  if (projectsResult.status === 401 || projectsResult.status === 403) {
    redirect("/login?next=/dashboard");
  }

  if (!projectsResult.body || !artifactsResult.body) {
    throw new Error("Dashboard response was empty.");
  }

  const { projects } = projectsResult.body;
  const { artifacts } = artifactsResult.body;

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
          <p className="eyebrow">Workspace</p>
          <h1>Dashboard</h1>
          <p className="subtle">Projects and artifacts owned by your signed-in account.</p>
        </div>
        <Link className="ghost-button" href="/settings/account">
          Account settings
        </Link>
      </header>

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
