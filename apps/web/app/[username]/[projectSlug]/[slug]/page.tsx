import Link from "next/link";
import { cookies } from "next/headers";
import { artifactPath, cookieHeader, fetchArtifactContent, loadArtifactGate } from "../../../../lib/server-api";
import { wrapHtmlWithCsp } from "../../../components/html-csp";
import { MarkdownViewer } from "../../../components/markdown-viewer";
import { JsxViewer } from "../../../components/jsx-viewer";
import { RestrictedArtifactView } from "../../../components/restricted-artifact-view";

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

  const gate = await loadArtifactGate(params.username, params.projectSlug, params.slug, header, {
    redirectPath: path
  });
  if (gate.kind === "restricted") {
    return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
  }
  const meta = gate.meta;

  const versionNumber = searchParams.version ? Number.parseInt(searchParams.version, 10) : undefined;

  const contentResult = await fetchArtifactContent(meta.id, header, Number.isFinite(versionNumber) ? versionNumber : undefined);

  if (!contentResult.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load content</h1>
        <p className="muted">HTTP {contentResult.status}</p>
      </main>
    );
  }

  const { content, contentType } = contentResult.body;
  const base = artifactPath(meta);

  return (
    <main className="page-shell wide">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {meta.type.toUpperCase()} · v{searchParams.version ?? "latest"}
          </p>
          <h1>{meta.title}</h1>
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
        {meta.type === "html" && (
          <iframe className="artifact-frame" referrerPolicy="no-referrer" sandbox="allow-scripts" srcDoc={wrapHtmlWithCsp(content)} title="HTML artifact preview" />
        )}
        {meta.type === "md" && (
          <MarkdownViewer content={content} />
        )}
        {meta.type === "jsx" && (
          <JsxViewer content={content} />
        )}
        <p className="muted small">Rendered as {contentType}</p>
      </section>
    </main>
  );
}
