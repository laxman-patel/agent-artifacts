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
  const activeVersion = searchParams.version ?? "latest";

  return (
    <main className="artifact-render-shell">
      <details className="artifact-inspector">
        <summary aria-label="Open artifact details">i</summary>
        <div className="artifact-inspector-panel">
          <p className="eyebrow">Artifact</p>
          <h1>{meta.title}</h1>
          <dl className="artifact-meta-grid">
            <div>
              <dt>Path</dt>
              <dd>{base}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{meta.type}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>v{activeVersion}</dd>
            </div>
            <div>
              <dt>Rendered as</dt>
              <dd>{contentType}</dd>
            </div>
          </dl>
          <nav className="artifact-inspector-menu" aria-label="Artifact controls">
            <Link href={base}>Latest</Link>
            <Link href={`${base}/history`}>Versions</Link>
            <Link href={`${base}/settings`}>Access</Link>
            <Link href={`${base}/audit`}>Audit</Link>
          </nav>
        </div>
      </details>

      <section className="artifact-render-stage" aria-label={`${meta.title} artifact preview`}>
        {meta.type === "html" && (
          <iframe className="artifact-frame" referrerPolicy="no-referrer" sandbox="allow-scripts" srcDoc={wrapHtmlWithCsp(content)} title="HTML artifact preview" />
        )}
        {meta.type === "md" && (
          <MarkdownViewer content={content} />
        )}
        {meta.type === "jsx" && (
          <JsxViewer content={content} />
        )}
      </section>
    </main>
  );
}
