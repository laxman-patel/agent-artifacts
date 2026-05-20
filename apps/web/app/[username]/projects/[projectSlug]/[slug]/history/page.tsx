import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { artifactPath, cookieHeader, fetchArtifactMeta, fetchArtifactVersions } from "../../../../../../lib/server-api";

export default async function ArtifactHistoryPage(props: {
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

  const meta = await fetchArtifactMeta(params.username, params.projectSlug, params.slug, header);

  if (meta.ok === false && meta.status === 404) {
    notFound();
  }

  if (meta.ok === false && meta.status === 403) {
    return (
      <main className="shell narrow">
        <h1>Restricted artifact</h1>
        <p className="muted">{meta.message}</p>
        <Link className="primary-button" href={`/login?next=${encodeURIComponent(`${path}/history`)}`}>
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const versions = await fetchArtifactVersions(meta.artifact.id, header);

  if (!versions.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load history</h1>
        <p className="muted">HTTP {versions.status}</p>
      </main>
    );
  }

  const base = artifactPath(meta.artifact);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>{meta.artifact.title}</h1>
          <p className="subtle">{base}</p>
        </div>
        <Link className="ghost-button" href={base}>
          Latest version
        </Link>
      </header>

      <section className="card flat">
        <ol className="version-list">
          {versions.body.versions.map((version, index) => {
            const previous = versions.body.versions[index + 1];

            return (
              <li key={version.id}>
                <div>
                  <strong>Version {version.versionNumber}</strong>
                  <p className="muted small">{new Date(version.createdAt).toLocaleString()}</p>
                  {version.changelog ? <p>{version.changelog}</p> : null}
                </div>
                <div className="row-actions">
                  <Link href={`${base}?version=${version.versionNumber}`}>View</Link>
                  {previous ? (
                    <Link href={`${base}/diff/${previous.versionNumber}/${version.versionNumber}`}>
                      Diff vs v{previous.versionNumber}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
