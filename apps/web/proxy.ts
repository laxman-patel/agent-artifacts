import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasAuthenticatedSession } from "./lib/server-auth";

// Coarse login redirect for /dashboard and /settings only; artifact pages gate themselves (share links, partial visibility).
function needsAuthProtection(pathname: string): boolean {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/settings");
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!needsAuthProtection(pathname)) return NextResponse.next();

  const hasSession = await hasAuthenticatedSession(request.headers.get("cookie"));
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/settings/:path*"] };
