import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
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

export default async function ShareTokenPage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;

  const response = await fetch(
    `${internalApiOrigin()}/api/share/${encodeURIComponent(token)}`,
    { cache: "no-store" }
  );

  if (response.status === 404 || response.status === 410) {
    notFound();
  }

  if (!response.ok) {
    throw new Error(`Share token resolve failed (HTTP ${response.status})`);
  }

  const body = (await response.json()) as ShareResolveResponse;

  // Set a per-artifact share session cookie. API middleware reads this and
  // augments the requester's effective role on subsequent calls to
  // /api/artifacts/{body.artifactId}/*. Cookie is scoped to the artifact id
  // in the name so concurrent share grants for different artifacts don't
  // clobber each other.
  const cookieStore = await cookies();
  cookieStore.set(`aa_share_${body.artifactId}`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  redirect(`/${body.artifact.ownerUsername}/${body.artifact.projectSlug}/${body.artifact.slug}`);
}
