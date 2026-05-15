import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cookieHeader, fetchOwnedArtifacts } from "../../lib/server-api";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const result = await fetchOwnedArtifacts(header);

  if (result.status === 401 || result.status === 403) {
    redirect("/login?next=/dashboard");
  }

  if (!result.body) {
    throw new Error("Dashboard response was empty.");
  }

  const { artifacts } = result.body;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Dashboard</h1>
          <p className="subtle">Artifacts owned by your signed-in account.</p>
        </div>
        <Link className="ghost-button" href="/settings/account">
          Account settings
        </Link>
      </header>

      <section className="card flat">
        {artifacts.length === 0 ? (
          <p className="muted">No artifacts yet. Create one via the HTTP API or MCP in Part 4.</p>
        ) : (
          <ul className="artifact-list">
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <div>
                  <Link href={`/${artifact.ownerUsername}/${artifact.slug}`}>
                    <strong>{artifact.title}</strong>
                  </Link>
                  <p className="muted small">
                    {artifact.type} · /{artifact.ownerUsername}/{artifact.slug}
                  </p>
                </div>
                <div className="row-actions">
                  <Link href={`/${artifact.ownerUsername}/${artifact.slug}/history`}>History</Link>
                  <Link href={`/${artifact.ownerUsername}/${artifact.slug}/settings`}>Access</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
