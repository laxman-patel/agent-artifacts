import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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

  const sessionResponse = await fetch(new URL("/api/auth/get-session", request.nextUrl.origin), {
    headers: {
      cookie: request.headers.get("cookie") ?? ""
    },
    cache: "no-store"
  });

  let payload: unknown;
  try {
    payload = await sessionResponse.json();
  } catch {
    payload = null;
  }

  const hasSession =
    Boolean(payload) &&
    typeof payload === "object" &&
    payload !== null &&
    "session" in payload &&
    Boolean((payload as { session?: unknown }).session);

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
