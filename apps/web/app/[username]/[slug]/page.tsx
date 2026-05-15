import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cookieHeader, fetchArtifactContent, fetchArtifactMeta } from "../../../lib/server-api";
import { MarkdownViewer } from "../../components/markdown-viewer";
import { ReactViewer } from "../../components/react-viewer";

export default async function ArtifactPage(props: {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
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
        <Link className="primary-button" href={`/login?next=/${encodeURIComponent(params.username)}/${encodeURIComponent(params.slug)}`}>
          Sign in with Google
        </Link>
      </main>
    );
  }

  if (!meta.ok) {
    throw new Error("Unexpected artifact response");
  }

  const versionNumber = searchParams.version ? Number.parseInt(searchParams.version, 10) : undefined;

  const contentResult = await fetchArtifactContent(meta.artifact.id, header, Number.isFinite(versionNumber) ? versionNumber : undefined);

  if (!contentResult.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load content</h1>
        <p className="muted">HTTP {contentResult.status}</p>
      </main>
    );
  }

  const { content, contentType } = contentResult;

  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {meta.artifact.type.toUpperCase()} · v{searchParams.version ?? "latest"}
          </p>
          <h1>{meta.artifact.title}</h1>
          <p className="subtle">
            /{meta.artifact.ownerUsername}/{meta.artifact.slug}
          </p>
        </div>
        <div className="row-actions wrap">
          <Link className="ghost-button" href={`/${meta.artifact.ownerUsername}/${meta.artifact.slug}/history`}>
            History
          </Link>
          <Link className="ghost-button" href={`/${meta.artifact.ownerUsername}/${meta.artifact.slug}/settings`}>
            Access
          </Link>
        </div>
      </header>

      <section className="card flat viewer-card">
        {meta.artifact.type === "html" && (
          <iframe className="artifact-frame" referrerPolicy="no-referrer" sandbox="allow-scripts" srcDoc={content} title="HTML artifact preview" />
        )}
        {meta.artifact.type === "markdown" && (
          <MarkdownViewer content={content} />
        )}
        {meta.artifact.type === "react" && (
          <ReactViewer content={content} />
        )}
        <p className="muted small">Rendered as {contentType}</p>
      </section>
    </main>
  );
}
