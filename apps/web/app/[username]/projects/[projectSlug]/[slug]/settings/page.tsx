import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AccessSettingsForm } from "../../../../../components/access-settings-form";
import { DeleteArtifactButton } from "../../../../../components/delete-artifact-button";
import { ShareLinksManager } from "../../../../../components/share-links-manager";
import { artifactPath, cookieHeader, fetchArtifactAccess, fetchArtifactMeta, fetchShareLinks } from "../../../../../../lib/server-api";

export default async function ArtifactSettingsPage(props: {
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
        <Link className="primary-button" href={`/login?next=${encodeURIComponent(`${path}/settings`)}`}>
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const [access, shareLinksResult] = await Promise.all([
    fetchArtifactAccess(meta.artifact.id, header),
    fetchShareLinks(meta.artifact.id, header)
  ]);

  if (access.ok === false && access.status === 403) {
    return (
      <main className="shell narrow">
        <h1>Admin access required</h1>
        <p className="muted">Only artifact admins can change access rules.</p>
        <Link href={path}>Back to artifact</Link>
      </main>
    );
  }

  if (!access.ok || !access.body) {
    throw new Error("Unexpected access response");
  }

  const base = artifactPath(meta.artifact);

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Access · {meta.artifact.title}</h1>
          <p className="subtle">{base}</p>
        </div>
        <Link className="ghost-button" href={base}>
          Back to artifact
        </Link>
      </header>

      <section className="card flat">
        <AccessSettingsForm
          artifactId={meta.artifact.id}
          initialPublicEdit={access.body.publicEdit}
          initialPublicView={access.body.publicView}
          initialViewerEmails={access.body.viewerEmails}
        />
      </section>

      <section className="card flat">
        <h2>Share links</h2>
        <p className="muted small">Create revocable links granting access without requiring sign-in.</p>
        <ShareLinksManager
          artifactId={meta.artifact.id}
          initialLinks={shareLinksResult.ok && shareLinksResult.body ? shareLinksResult.body.shareLinks : []}
        />
      </section>

      <section className="card flat">
        <h2>Activity</h2>
        <Link className="ghost-button" href={`${base}/audit`}>
          View audit log
        </Link>
      </section>

      <section className="card flat danger-zone">
        <h2>Danger zone</h2>
        <p className="muted small">
          Deleting hides this artifact from all reads and revokes all access. Audit history is preserved. Only the artifact owner can do this.
        </p>
        <DeleteArtifactButton artifactId={meta.artifact.id} artifactTitle={meta.artifact.title} />
      </section>
    </main>
  );
}
