import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  artifactPath,
  cookieHeader,
  fetchWorkspaceArtifacts,
  fetchWorkspaceProjects,
  fetchWorkspaces,
  projectPath,
  workspaceSettingsPath,
  type WorkspaceSummary
} from "../../../lib/server-api";

function workspaceLabel(workspace: WorkspaceSummary) {
  return workspace.kind === "personal" ? "Personal" : workspace.name;
}

export default async function WorkspaceDashboardPage(props: { params: Promise<{ workspaceSlug: string }> }) {
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

  const recentArtifacts = artifacts.slice(0, 12);
  const artifactsByProject = new Map<string, typeof artifacts>();
  for (const artifact of artifacts) {
    const list = artifactsByProject.get(artifact.projectId) ?? [];
    list.push(artifact);
    artifactsByProject.set(artifact.projectId, list);
  }

  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">{workspace.kind === "personal" ? "Personal workspace" : "Team workspace"}</p>
          <h1>{workspaceLabel(workspace)}</h1>
          <p className="meta-line">/{workspace.slug} · {workspace.role}</p>
        </div>
        <div className="row-actions">
          <Link className="ghost-button" href="/workspaces/new">
            New team
          </Link>
          {workspace.kind === "team" ? (
            <Link className="ghost-button" href={workspaceSettingsPath(workspace)}>
              Settings
            </Link>
          ) : (
            <Link className="ghost-button" href="/settings/account">
              Account
            </Link>
          )}
        </div>
      </header>

      {workspacesResult.body.workspaces.length > 1 ? (
        <section className="card flat stack">
          <h2>Workspaces</h2>
          <div className="row-actions">
            {workspacesResult.body.workspaces.map((item) => (
              <Link key={item.id} className="ghost-button" href={`/dashboard/${item.slug}`}>
                {workspaceLabel(item)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {loadWarnings.length > 0 ? (
        <section className="card flat">
          <p className="muted">{loadWarnings.join(" ")}</p>
        </section>
      ) : null}

      <section className="card flat stack">
        <div className="section-header">
          <p className="eyebrow">Recent artifacts</p>
          <h2>Artifact stream</h2>
          <p className="muted small">Open the artifact first; inspect versions and access only when needed.</p>
        </div>
        {recentArtifacts.length === 0 ? (
          <p className="empty-state">No artifacts yet. Publish one with the CLI or MCP using workspace /{workspace.slug}.</p>
        ) : (
          <ul className="artifact-list">
            {recentArtifacts.map((artifact) => (
              <li key={artifact.id}>
                <div>
                  <Link href={artifactPath(artifact)}>
                    <strong>{artifact.title}</strong>
                  </Link>
                  <p className="meta-line small">
                    <span className="chip">{artifact.type}</span>
                    <span>{artifactPath(artifact)}</span>
                    <span>updated {new Date(artifact.updatedAt).toLocaleDateString()}</span>
                  </p>
                </div>
                <div className="row-actions">
                  <Link href={artifactPath(artifact)}>Open</Link>
                  <Link href={`${artifactPath(artifact)}/history`}>Versions</Link>
                  <Link href={`${artifactPath(artifact)}/settings`}>Access</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flat stack">
        <div className="section-header">
          <p className="eyebrow">Projects</p>
          <h2>Project namespaces</h2>
          <p className="muted small">Artifacts stay grouped by durable URL namespaces.</p>
        </div>
        {projects.length === 0 ? (
          <p className="empty-state">No projects in this workspace yet.</p>
        ) : (
          <ul className="artifact-list">
            {projects.map((project) => {
              const projectArtifacts = artifactsByProject.get(project.id) ?? [];
              return (
                <li key={project.id}>
                  <div>
                    <Link href={projectPath(project)}>
                      <strong>{project.title}</strong>
                    </Link>
                    <p className="meta-line small">
                      <span>{projectPath(project)}</span>
                      <span>{projectArtifacts.length} artifact{projectArtifacts.length === 1 ? "" : "s"}</span>
                      <span>updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
