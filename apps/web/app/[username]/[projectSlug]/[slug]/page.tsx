import type { Metadata } from "next";
import { cookies } from "next/headers";
import { artifactPath, cookieHeader, fetchArtifactContent, loadArtifactGate } from "../../../../lib/server-api";
import {
  GENERIC_OG_DESCRIPTION,
  genericOpenGraphMetadata,
  SITE_NAME
} from "../../../../lib/site-metadata";
import { loadPublicArtifactPreview } from "../../../../lib/artifact-preview";
import { wrapHtmlWithCsp } from "../../../components/html-csp";
import { MarkdownViewer } from "../../../components/markdown-viewer";
import { JsxViewer } from "../../../components/jsx-viewer";
import { RestrictedArtifactView } from "../../../components/restricted-artifact-view";
import { ArtifactControlMenu } from "../../../components/artifact-control-menu";
import "../../../workbench.css";

type ArtifactPageParams = { username: string; projectSlug: string; slug: string };
type ArtifactPageProps = {
  params: Promise<ArtifactPageParams>;
  searchParams: Promise<{ version?: string }>;
};

export async function generateMetadata(props: { params: Promise<ArtifactPageParams> }): Promise<Metadata> {
  const params = await props.params;
  const path = artifactPath({
    ownerUsername: params.username,
    projectSlug: params.projectSlug,
    slug: params.slug
  });
  const preview = await loadPublicArtifactPreview(params.username, params.projectSlug, params.slug);

  if (!preview) {
    return {
      title: "Open artifact",
      description: GENERIC_OG_DESCRIPTION,
      alternates: { canonical: path },
      ...genericOpenGraphMetadata(path)
    };
  }

  const imageVersion = encodeURIComponent(preview.latestVersionId ?? preview.updatedAt);
  const imagePath = `${path}/opengraph-image?v=${imageVersion}`;

  return {
    title: preview.title,
    description: preview.description,
    alternates: { canonical: path },
    openGraph: {
      title: preview.title,
      description: preview.description,
      url: path,
      siteName: SITE_NAME,
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: `${preview.title} artifact preview`
        }
      ],
      type: "article"
    },
    twitter: {
      card: "summary_large_image",
      title: preview.title,
      description: preview.description,
      images: [imagePath]
    }
  };
}

export default async function ArtifactPage(props: ArtifactPageProps) {
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

  const parsedVersion = searchParams.version ? Number.parseInt(searchParams.version, 10) : undefined;
  const viewedVersion = typeof parsedVersion === "number" && Number.isFinite(parsedVersion) ? parsedVersion : null;

  const contentResult = await fetchArtifactContent(meta.id, header, viewedVersion ?? undefined);

  if (!contentResult.ok) {
    return (
      <main className="wb-stage flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">Render failed</p>
        <h1 className="text-lg font-medium text-white/90">Cannot load this artifact</h1>
        <p className="font-mono text-xs text-white/45">HTTP {contentResult.status}</p>
      </main>
    );
  }

  const { content } = contentResult.body;
  const base = artifactPath(meta);
  return (
    <main className="wb-stage relative flex h-dvh w-full flex-col">
      <ArtifactControlMenu
        title={meta.title}
        type={meta.type}
        base={base}
        artifactId={meta.id}
        viewedVersion={viewedVersion}
        workspaceSlug={meta.workspaceSlug}
        publicView={meta.publicView}
      />

      <div className="wb-stage-body">
        {meta.type === "html" && (
          <iframe
            className="wb-stage-frame"
            referrerPolicy="no-referrer"
            sandbox="allow-scripts"
            srcDoc={wrapHtmlWithCsp(content)}
            title={meta.title}
          />
        )}
        {meta.type === "jsx" && <JsxViewer content={content} />}
        {meta.type === "md" && (
          <div className="wb-scroll absolute inset-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-[820px] px-4 py-12 sm:py-16">
              <MarkdownViewer content={content} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
