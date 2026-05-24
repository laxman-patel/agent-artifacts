import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { artifactPath, cookieHeader, fetchProjectByPath, projectPath } from "../../../lib/server-api";

export default async function ProjectPage(props: {
  params: Promise<{ username: string; projectSlug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const result = await fetchProjectByPath(params.username, params.projectSlug, header);

  if (!result.ok && result.status === 404) {
    notFound();
  }

  if (!result.ok || !result.body) {
    throw new Error("Unexpected project response");
  }

  const { project, artifacts } = result.body;
  const base = projectPath(project);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Project</p>
          <h1>{project.title}</h1>
          <p className="subtle">{base}</p>
          {project.description ? <p className="muted">{project.description}</p> : null}
        </div>
        <Link className="ghost-button" href={`/${params.username}`}>
          All projects
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
    </main>
  );
}
