import { NextResponse, type NextRequest } from "next/server";
import { internalApiOrigin } from "../../../lib/server-api";

interface ShareResolveResponse {
  artifactId: string;
  role: "viewer" | "editor";
  artifact: {
    ownerUsername: string;
    projectSlug: string;
    slug: string;
  };
}

export async function GET(request: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  const response = await fetch(
    `${internalApiOrigin()}/api/share/${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );

  if (response.status === 404 || response.status === 410) {
    return new Response("Share link not found.", { status: 404 });
  }

  if (!response.ok) {
    throw new Error(`Share token resolve failed (HTTP ${response.status})`);
  }

  const body = (await response.json()) as ShareResolveResponse;
  const redirectUrl = new URL(
    `/${body.artifact.ownerUsername}/${body.artifact.projectSlug}/${body.artifact.slug}`,
    request.nextUrl.origin
  );
  const redirectResponse = NextResponse.redirect(redirectUrl);

  redirectResponse.cookies.set(`aa_share_${body.artifactId}`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return redirectResponse;
}
