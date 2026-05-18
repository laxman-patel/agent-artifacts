import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cookieHeader, fetchArtifactMeta, fetchAuditEvents } from "../../../../lib/server-api";

export default async function AuditLogPage(props: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const meta = await fetchArtifactMeta(params.username, params.slug, header);

  if (meta.ok === false && meta.status === 404) {
    notFound();
  }

  if (meta.ok === false && meta.status === 403) {
    return (
      <main className="shell narrow">
        <h1>Restricted artifact</h1>
        <p className="muted">{meta.message}</p>
        <Link className="primary-button" href={`/login?next=/${params.username}/${params.slug}/audit`}>
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const eventsResult = await fetchAuditEvents(header, { artifactId: meta.artifact.id });

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Audit log</p>
          <h1>{meta.artifact.title}</h1>
          <p className="subtle">/{meta.artifact.ownerUsername}/{meta.artifact.slug}</p>
        </div>
        <div className="row-actions">
          <Link className="ghost-button" href={`/${meta.artifact.ownerUsername}/${meta.artifact.slug}/settings`}>
            Settings
          </Link>
          <Link className="ghost-button" href={`/${meta.artifact.ownerUsername}/${meta.artifact.slug}`}>
            Back to artifact
          </Link>
        </div>
      </header>

      <section className="card flat">
        {!eventsResult.ok && (
          <p className="muted">Could not load audit events. Admin access required.</p>
        )}
        {eventsResult.ok && eventsResult.body.events.length === 0 && (
          <p className="muted">No audit events yet.</p>
        )}
        {eventsResult.ok && eventsResult.body.events.length > 0 && (
          <table className="audit-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {eventsResult.body.events.map((event) => (
                <tr key={event.id}>
                  <td className="small muted">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="small"><code>{event.action}</code></td>
                  <td className="small muted">{event.actorPrincipalType}:{event.actorPrincipalId.slice(0, 8)}</td>
                  <td className="small muted">{event.targetType}:{event.targetId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
