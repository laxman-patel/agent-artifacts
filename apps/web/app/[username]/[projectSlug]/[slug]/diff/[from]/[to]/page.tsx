import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { artifactPath, cookieHeader, fetchArtifactDiff, loadArtifactGate } from "../../../../../../../lib/server-api";
import { RestrictedArtifactView } from "../../../../../../components/restricted-artifact-view";

export default async function ArtifactDiffPage(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string; from: string; to: string }>;
}) {
  const params = await props.params;
  const fromVersion = Number.parseInt(params.from, 10);
  const toVersion = Number.parseInt(params.to, 10);

  if (!Number.isFinite(fromVersion) || !Number.isFinite(toVersion)) {
    notFound();
  }

  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const path = artifactPath({
    ownerUsername: params.username,
    projectSlug: params.projectSlug,
    slug: params.slug
  });

  const gate = await loadArtifactGate(params.username, params.projectSlug, params.slug, header, {
    redirectPath: `${path}/diff/${params.from}/${params.to}`
  });
  if (gate.kind === "restricted") {
    return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
  }
  const meta = gate.meta;

  const diff = await fetchArtifactDiff(meta.id, header, fromVersion, toVersion);

  if (!diff.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot compute diff</h1>
        <p className="muted">HTTP {diff.status}</p>
      </main>
    );
  }

  const base = artifactPath(meta);

  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">Diff</p>
          <h1>
            {meta.title}{" "}
            <span className="muted">
              (v{fromVersion} → v{toVersion})
            </span>
          </h1>
          <p className="meta-line">{base}</p>
        </div>
        <Link className="ghost-button" href={`${base}/history`}>
          Versions
        </Link>
      </header>

      <section className="card flat">
        <pre className="diff-view">{diff.body.unifiedDiff}</pre>
      </section>
    </main>
  );
}
