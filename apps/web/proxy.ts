import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { hasAuthenticatedSession } from "./lib/server-auth";

function needsAuthProtection(pathname: string): boolean {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/settings")) {
    return true;
  }

  return /\/projects\/[^/]+\/[^/]+\/(settings|audit|history)(\/|$)/.test(pathname);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!needsAuthProtection(pathname)) {
    return NextResponse.next();
  }

  const hasSession = await hasAuthenticatedSession(request.headers.get("cookie"));

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*", "/:username/projects/:path*"]
};
