import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { artifactPath, cookieHeader, fetchArtifactMeta, fetchAuditEvents } from "../../../../../../lib/server-api";

export default async function ArtifactAuditPage(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);

  const meta = await fetchArtifactMeta(params.username, params.projectSlug, params.slug, header);

  if (meta.ok === false && meta.status === 404) {
    notFound();
  }

  if (meta.ok === false && meta.status === 403) {
    return (
      <main className="shell narrow">
        <h1>Restricted artifact</h1>
        <p className="muted">{meta.message}</p>
        <Link
          className="primary-button"
          href={`/login?next=${encodeURIComponent(`${artifactPath({ ownerUsername: params.username, projectSlug: params.projectSlug, slug: params.slug })}/audit`)}`}
        >
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const audit = await fetchAuditEvents(header, { artifactId: meta.artifact.id, limit: 100 });

  if (!audit.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load audit log</h1>
        <p className="muted">HTTP {audit.status}</p>
      </main>
    );
  }

  const base = artifactPath(meta.artifact);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Audit</p>
          <h1>{meta.artifact.title}</h1>
          <p className="subtle">{base}</p>
        </div>
        <div className="row-actions wrap">
          <Link className="ghost-button" href={`${base}/settings`}>
            Access settings
          </Link>
          <Link className="ghost-button" href={base}>
            Back to artifact
          </Link>
        </div>
      </header>

      <section className="card flat">
        <ol className="audit-list">
          {audit.body.events.map((event) => (
            <li key={event.id}>
              <strong>{event.action}</strong>
              <p className="muted small">
                {event.actorPrincipalType}:{event.actorPrincipalId} · {new Date(event.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
