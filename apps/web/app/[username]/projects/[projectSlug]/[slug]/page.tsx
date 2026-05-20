import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { artifactPath, cookieHeader, fetchArtifactContent, fetchArtifactMeta } from "../../../../../lib/server-api";
import { wrapHtmlWithCsp } from "../../../../components/html-csp";
import { MarkdownViewer } from "../../../../components/markdown-viewer";
import { ReactViewer } from "../../../../components/react-viewer";

export default async function ArtifactPage(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
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
        <Link className="primary-button" href={`/login?next=${encodeURIComponent(path)}`}>
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
  const base = artifactPath(meta.artifact);

  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {meta.artifact.type.toUpperCase()} · v{searchParams.version ?? "latest"}
          </p>
          <h1>{meta.artifact.title}</h1>
          <p className="subtle">{base}</p>
        </div>
        <div className="row-actions wrap">
          <Link className="ghost-button" href={`${base}/history`}>
            History
          </Link>
          <Link className="ghost-button" href={`${base}/settings`}>
            Access
          </Link>
        </div>
      </header>

      <section className="card flat viewer-card">
        {meta.artifact.type === "html" && (
          <iframe className="artifact-frame" referrerPolicy="no-referrer" sandbox="allow-scripts" srcDoc={wrapHtmlWithCsp(content)} title="HTML artifact preview" />
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
