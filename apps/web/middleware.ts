import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const needsProtection = pathname.startsWith("/dashboard") || pathname.startsWith("/settings");

  if (!needsProtection) {
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
  matcher: ["/dashboard/:path*", "/settings/:path*"]
};
