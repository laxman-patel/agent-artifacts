import type { Context, MiddlewareHandler } from "hono";

/**
 * CSRF defense for cookie-authenticated mutations.
 *
 * Browsers always send the `Origin` header on cross-origin POST/PUT/PATCH/DELETE.
 * Same-origin form submissions also send Origin (set to the page's origin).
 * If the Origin is missing or not in the trusted set, the request is rejected.
 *
 * Bearer-authenticated requests (Authorization: Bearer ...) are skipped because
 * an attacker on another origin cannot read the victim's bearer token from
 * inside a browser — CSRF only weaponizes the auto-attached cookie.
 *
 * Apply to mutation routes only. Read routes don't need CSRF protection.
 */
export function csrfOriginGuard(trustedOrigins: string[]): MiddlewareHandler {
  const trusted = new Set(trustedOrigins.map(normalizeOrigin));

  return async (c, next) => {
    if (c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "OPTIONS") {
      return next();
    }

    if (hasBearerAuthorization(c)) {
      return next();
    }

    const origin = c.req.header("origin");
    if (origin && trusted.has(normalizeOrigin(origin))) {
      return next();
    }

    return c.json(
      {
        error: "csrf_blocked",
        message: "Cross-origin request blocked. Origin header missing or not trusted."
      },
      403
    );
  };
}

function hasBearerAuthorization(c: Context): boolean {
  const value = c.req.header("authorization");
  return !!value && /^bearer\s+\S+/i.test(value);
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/, "").toLowerCase();
}
