import { ImageResponse } from "next/og";
import { loadPublicArtifactPreview } from "../../../../lib/artifact-preview";
import { ArtifactOgCard, GenericOgCard, OG_IMAGE_SIZE } from "../../../../lib/og-card";
import { loadOgFonts } from "../../../../lib/og-fonts";

export const alt = "Artifact link preview";
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const size = OG_IMAGE_SIZE;

export default async function Image(props: {
  params: Promise<{ username: string; projectSlug: string; slug: string }>;
}) {
  const params = await props.params;
  const preview = await loadPublicArtifactPreview(params.username, params.projectSlug, params.slug, {
    includeContent: true
  });

  return new ImageResponse(preview ? <ArtifactOgCard preview={preview} /> : <GenericOgCard />, {
    ...OG_IMAGE_SIZE,
    fonts: await loadOgFonts()
  });
}
