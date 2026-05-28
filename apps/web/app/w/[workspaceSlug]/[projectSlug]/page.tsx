import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  cookieHeader,
  fetchPublicWorkspaceBySlug,
  fetchWorkspaceProjectByPath,
  workspaceArtifactPath,
  workspacePath,
  workspaceProjectPath
} from "../../../../lib/server-api";

export default async function WorkspaceProjectPage(props: {
  params: Promise<{ workspaceSlug: string; projectSlug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const workspaceResult = await fetchPublicWorkspaceBySlug(params.workspaceSlug, header);

  if (!workspaceResult.ok && (workspaceResult.status === 401 || workspaceResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(`/w/${params.workspaceSlug}/${params.projectSlug}`)}`);
  }

  if (!workspaceResult.ok && workspaceResult.status === 404) {
    notFound();
  }

  if (!workspaceResult.ok) {
    throw new Error(workspaceResult.message ?? "Unexpected workspace response");
  }

  const { workspace } = workspaceResult.body;
  const result = await fetchWorkspaceProjectByPath(workspace.id, params.projectSlug, header);

  if (!result.ok && result.status === 404) {
    notFound();
  }

  if (!result.ok) {
    throw new Error(result.message ?? "Unexpected project response");
  }

  const { project, artifacts } = result.body;
  const base = workspaceProjectPath(workspace, project);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace project</p>
          <h1>{project.title}</h1>
          <p className="subtle">{base}</p>
          {project.description ? <p className="muted">{project.description}</p> : null}
        </div>
        <Link className="ghost-button" href={workspacePath(workspace)}>
          Back to workspace
        </Link>
      </header>

      <section className="card flat">
        {artifacts.length === 0 ? (
          <p className="muted">No artifacts in this project yet.</p>
        ) : (
          <ul className="artifact-list">
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <div>
                  <Link href={workspaceArtifactPath(workspace, artifact)}>
                    <strong>{artifact.title}</strong>
                  </Link>
                  <p className="muted small">
                    {artifact.type} · {workspaceArtifactPath(workspace, artifact)}
                  </p>
                </div>
                <div className="row-actions">
                  <Link href={`${workspaceArtifactPath(workspace, artifact)}/history`}>History</Link>
                  <Link href={`${workspaceArtifactPath(workspace, artifact)}/settings`}>Access</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
