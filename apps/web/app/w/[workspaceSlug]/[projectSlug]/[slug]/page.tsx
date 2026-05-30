import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  cookieHeader,
  fetchPublicWorkspaceBySlug,
  fetchArtifactContent,
  loadWorkspaceArtifactGate,
  workspaceArtifactPath
} from "../../../../../lib/server-api";
import { JsxViewer } from "../../../../components/jsx-viewer";
import { MarkdownViewer } from "../../../../components/markdown-viewer";
import { RestrictedArtifactView } from "../../../../components/restricted-artifact-view";
import { wrapHtmlWithCsp } from "../../../../components/html-csp";

export default async function WorkspaceArtifactPage(props: {
  params: Promise<{ workspaceSlug: string; projectSlug: string; slug: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const header = cookieHeader(cookieStore);
  const path = `/w/${params.workspaceSlug}/${params.projectSlug}/${params.slug}`;
  const workspaceResult = await fetchPublicWorkspaceBySlug(params.workspaceSlug, header);

  if (!workspaceResult.ok && (workspaceResult.status === 401 || workspaceResult.status === 403)) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  if (!workspaceResult.ok && workspaceResult.status === 404) {
    notFound();
  }

  if (!workspaceResult.ok) {
    throw new Error(workspaceResult.message ?? "Unexpected workspace response");
  }

  const { workspace } = workspaceResult.body;
  const gate = await loadWorkspaceArtifactGate(workspace.id, params.projectSlug, params.slug, header, {
    redirectPath: path
  });
  if (gate.kind === "restricted") {
    return <RestrictedArtifactView message={gate.message} loginHref={gate.loginHref} />;
  }

  const meta = gate.meta;
  const parsedVersionNumber =
    searchParams.version && /^\d+$/.test(searchParams.version)
      ? Number.parseInt(searchParams.version, 10)
      : undefined;
  const versionNumber =
    parsedVersionNumber !== undefined && Number.isSafeInteger(parsedVersionNumber) && parsedVersionNumber > 0
      ? parsedVersionNumber
      : undefined;
  const contentResult = await fetchArtifactContent(meta.id, header, versionNumber);

  if (!contentResult.ok) {
    return (
      <main className="shell narrow">
        <h1>Cannot load content</h1>
        <p className="muted">HTTP {contentResult.status}</p>
      </main>
    );
  }

  const { content, contentType } = contentResult.body;
  const base = workspaceArtifactPath(workspace, meta);

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
        {meta.type === "md" && <MarkdownViewer content={content} />}
        {meta.type === "jsx" && <JsxViewer content={content} />}
        <p className="muted small">Rendered as {contentType}</p>
      </section>
    </main>
  );
}
