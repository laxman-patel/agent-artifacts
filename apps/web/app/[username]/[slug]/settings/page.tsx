import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AccessSettingsForm } from "../../../components/access-settings-form";
import { cookieHeader, fetchArtifactAccess, fetchArtifactMeta } from "../../../../lib/server-api";

export default async function ArtifactSettingsPage(props: {
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
        <Link className="primary-button" href={`/login?next=/${params.username}/${params.slug}/settings`}>
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const access = await fetchArtifactAccess(meta.artifact.id, header);

  if (access.ok === false && access.status === 403) {
    return (
      <main className="shell narrow">
        <h1>Admin access required</h1>
        <p className="muted">Only artifact admins can change access rules.</p>
        <Link href={`/${params.username}/${params.slug}`}>Back to artifact</Link>
      </main>
    );
  }

  if (!access.ok || !access.body) {
    throw new Error("Unexpected access response");
  }

  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Access · {meta.artifact.title}</h1>
          <p className="subtle">
            Namespace /{meta.artifact.ownerUsername}/{meta.artifact.slug}
          </p>
        </div>
        <Link className="ghost-button" href={`/${meta.artifact.ownerUsername}/${meta.artifact.slug}`}>
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
    </main>
  );
}
