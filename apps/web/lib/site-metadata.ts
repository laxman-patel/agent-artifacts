import type { Metadata } from "next";

const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_DOCS_URL = "https://docs.hostartifacts.dev";

export const SITE_NAME = "Artifacts";
export const SITE_TITLE = "Artifacts | Agent-native artifact hosting";
export const SITE_DESCRIPTION =
  "Publish HTML reports, Markdown specs, JSX prototypes, and agent-built tools with permanent URLs, immutable versions, access control, and MCP automation.";
export const GENERIC_OG_DESCRIPTION =
  "Open this artifact on Artifacts, the agent-native home for hosted HTML reports, Markdown specs, and JSX prototypes.";

export function publicAppUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/+$/, "");
}

export function docsUrl(): string {
  return (process.env.NEXT_PUBLIC_DOCS_URL ?? DEFAULT_DOCS_URL).replace(/\/+$/, "");
}

export function absoluteUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${publicAppUrl()}${normalizedPath}`;
}

export function genericOpenGraphMetadata(path = "/"): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      title: SITE_TITLE,
      description: GENERIC_OG_DESCRIPTION,
      url: path,
      siteName: SITE_NAME,
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "Artifacts link preview"
        }
      ],
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_TITLE,
      description: GENERIC_OG_DESCRIPTION,
      images: ["/opengraph-image"]
    }
  };
}
