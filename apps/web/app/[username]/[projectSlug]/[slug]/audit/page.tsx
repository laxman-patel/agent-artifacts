import Link from "next/link";
import { cookies } from "next/headers";
import { artifactPath, cookieHeader, fetchAuditEvents, loadArtifactGate } from "../../../../../lib/server-api";
import { RestrictedArtifactView } from "../../../../components/restricted-artifact-view";

export default async function ArtifactAuditPage(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const path = artifactPath({
    ownerUsername: params.username,
    projectSlug: params.projectSlug,
    slug: params.slug
  });

  const gate = await loadArtifactGate(params.username, params.projectSlug, params.slug, header, {
    redirectPath: `${path}/audit`
  });
  if (gate.kind === "restricted") {
    return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
  }
  const meta = gate.meta;

  const audit = await fetchAuditEvents(header, { artifactId: meta.id, limit: 100 });

  if (!audit.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load audit log</h1>
        <p className="muted">HTTP {audit.status}</p>
      </main>
    );
  }

  const base = artifactPath(meta);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Audit</p>
          <h1>{meta.title}</h1>
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
