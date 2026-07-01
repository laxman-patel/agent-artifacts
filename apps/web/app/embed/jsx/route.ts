import { cookies } from "next/headers";
import { buildJsxSandboxHtml, JSX_SANDBOX_CSP } from "../../../lib/jsx-sandbox";
import { cookieHeader, fetchArtifactContent } from "../../../lib/server-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const artifactId = url.searchParams.get("artifactId");
  if (!artifactId) {
    return new Response("Missing artifactId", { status: 400 });
  }

  const versionParam = url.searchParams.get("version");
  const parsedVersion = versionParam ? Number.parseInt(versionParam, 10) : undefined;
  const version =
    typeof parsedVersion === "number" && Number.isFinite(parsedVersion) ? parsedVersion : undefined;

  const cookieStore = await cookies();
  const result = await fetchArtifactContent(artifactId, cookieHeader(cookieStore), version);
  if (!result.ok) {
    return new Response("Cannot load artifact", { status: result.status });
  }

  return new Response(buildJsxSandboxHtml(result.body.content), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": JSX_SANDBOX_CSP,
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "private, no-store"
    }
  });
}
