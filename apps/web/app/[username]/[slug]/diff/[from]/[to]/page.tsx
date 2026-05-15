import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cookieHeader, fetchArtifactDiff, fetchArtifactMeta } from "../../../../../../lib/server-api";

export default async function ArtifactDiffPage(props: {
  params: Promise<{ username: string; slug: string; from: string; to: string }>;
}) {
  const params = await props.params;
  const fromVersion = Number.parseInt(params.from, 10);
  const toVersion = Number.parseInt(params.to, 10);

  if (!Number.isFinite(fromVersion) || !Number.isFinite(toVersion)) {
    notFound();
  }

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
        <Link
          className="primary-button"
          href={`/login?next=/${encodeURIComponent(params.username)}/${encodeURIComponent(params.slug)}/diff/${params.from}/${params.to}`}
        >
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const diff = await fetchArtifactDiff(meta.artifact.id, header, fromVersion, toVersion);

  if (!diff.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot compute diff</h1>
        <p className="muted">HTTP {diff.status}</p>
      </main>
    );
  }

  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Diff</p>
          <h1>
            {meta.artifact.title}{" "}
            <span className="muted">
              (v{fromVersion} → v{toVersion})
            </span>
          </h1>
          <p className="subtle">
            /{meta.artifact.ownerUsername}/{meta.artifact.slug}
          </p>
        </div>
        <Link className="ghost-button" href={`/${meta.artifact.ownerUsername}/${meta.artifact.slug}/history`}>
          Back to history
        </Link>
      </header>

      <section className="card flat">
        <pre className="diff-view">{diff.body.unifiedDiff}</pre>
      </section>
    </main>
  );
}
