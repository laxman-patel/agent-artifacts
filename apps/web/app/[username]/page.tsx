import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cookieHeader, fetchPublicProjects, projectPath } from "../../lib/server-api";

export default async function UserProjectsPage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const result = await fetchPublicProjects(params.username, header);

  if (!result.ok) {
    notFound();
  }

  const { projects } = result.body;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h1>@{params.username}</h1>
          <p className="subtle">Projects group artifacts under durable URL namespaces.</p>
        </div>
        <Link className="ghost-button" href="/dashboard">
          Dashboard
        </Link>
      </header>

      <section className="card flat">
        {projects.length === 0 ? (
          <p className="empty-state">No projects yet. Create one via the API or MCP.</p>
        ) : (
          <ul className="artifact-list">
            {projects.map((project) => (
              <li key={project.id}>
                <div>
                  <Link href={projectPath(project)}>
                    <strong>{project.title}</strong>
                  </Link>
                  <p className="meta-line small">
                    <span>{projectPath(project)}</span>
                    <span>updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
