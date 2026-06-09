import { ImageResponse } from "next/og";
import { GenericOgCard, OG_IMAGE_SIZE } from "../lib/og-card";

export const alt = "Artifacts link preview";
export const contentType = "image/png";
export const runtime = "nodejs";
export const size = OG_IMAGE_SIZE;

export default async function Image() {
  return new ImageResponse(<GenericOgCard />, {
    ...OG_IMAGE_SIZE
  });
}
