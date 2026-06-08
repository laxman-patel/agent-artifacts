import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Coarse login redirect for /dashboard and /settings only; artifact pages gate themselves (share links, partial visibility).
// `/_betterstack/*` is outside this matcher today. If the matcher is ever widened, exclude `/_betterstack/(.*)`
// so Better Stack browser log/web-vitals proxy routes stay reachable (see @logtail/next docs).
function needsAuthProtection(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/settings");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!needsAuthProtection(pathname)) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get("better-auth.session_token")?.value);
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/settings/:path*"] };
