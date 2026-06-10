import Link from "next/link";
import { readSessionCookie } from "@agent-artifacts/shared";
import { cookies } from "next/headers";
import { artifactPath, cookieHeader, fetchArtifactPermissions, fetchArtifactVersions, loadArtifactGate } from "../../../../../lib/server-api";
import { ArtifactRestoreButton } from "../../../../components/artifact-restore-button";
import { RestrictedArtifactView } from "../../../../components/restricted-artifact-view";

export default async function ArtifactHistoryPage(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string }>;
}) {
  const params = await props.params;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const hasSession = Boolean(readSessionCookie(cookieStore));
  const path = artifactPath({
    ownerUsername: params.username,
    projectSlug: params.projectSlug,
    slug: params.slug
  });

  const gate = await loadArtifactGate(params.username, params.projectSlug, params.slug, header, {
    redirectPath: `${path}/history`
  });
  if (gate.kind === "restricted") {
    return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
  }
  const meta = gate.meta;

  const [versions, permissions] = await Promise.all([
    fetchArtifactVersions(meta.id, header),
    hasSession ? fetchArtifactPermissions(meta.id, header) : Promise.resolve(null)
  ]);

  if (!versions.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load history</h1>
        <p className="muted">HTTP {versions.status}</p>
      </main>
    );
  }

  const base = artifactPath(meta);
  const canRestore = permissions?.ok === true && permissions.body.canRestore;

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">History</p>
          <h1>{meta.title}</h1>
          <p className="meta-line">{base}</p>
        </div>
        <Link className="ghost-button" href={base}>
          Artifact
        </Link>
      </header>

      <section className="card flat">
        {versions.body.versions.length === 0 ? (
          <p className="empty-state">No versions have been written yet.</p>
        ) : (
          <ol className="version-list">
            {versions.body.versions.map((version, index) => {
              const previous = versions.body.versions[index + 1];

              return (
                <li key={version.id}>
                  <div>
                    <strong>Version {version.versionNumber}</strong>
                    <p className="meta-line small">{new Date(version.createdAt).toLocaleString()}</p>
                    {version.changelog ? <p className="muted">{version.changelog}</p> : null}
                  </div>
                  <div className="row-actions">
                    <Link href={`${base}?version=${version.versionNumber}`}>View</Link>
                    {previous ? (
                      <Link href={`${base}/diff/${previous.versionNumber}/${version.versionNumber}`}>
                        Diff vs v{previous.versionNumber}
                      </Link>
                    ) : null}
                    {canRestore ? <ArtifactRestoreButton artifactId={meta.id} versionNumber={version.versionNumber} /> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
