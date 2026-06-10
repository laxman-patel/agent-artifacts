import type { Context } from "hono";
import { createUserPrincipal } from "@agent-artifacts/auth";
import { ArtifactForbiddenError, type Principal } from "@agent-artifacts/shared";
import { getApiKeyService, getAuth, getShareLinkService } from "../deps.js";

function isTransientDbError(error: unknown): boolean {
  const codes = new Set(["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"]);
  const queue: unknown[] = [error];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== "object") {
      continue;
    }

    if ("code" in current && typeof current.code === "string" && codes.has(current.code)) {
      return true;
    }

    if ("cause" in current) {
      queue.push(current.cause);
    }

    if ("errors" in current && Array.isArray(current.errors)) {
      queue.push(...current.errors);
    }
  }

  return false;
}

async function getSessionFromRequest(request: Request) {
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await getAuth().api.getSession({ headers: request.headers });
    } catch (error) {
      if (!isTransientDbError(error) || attempt === maxAttempts - 1) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }

  return null;
}

function bearerToken(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^bearer\s+(\S+)$/i);
  return match?.[1];
}

async function getApiKeyPrincipalFromRequest(request: Request): Promise<Principal | undefined> {
  const token = bearerToken(request);
  if (!token) {
    return undefined;
  }

  return getApiKeyService().authenticateToken(token);
}

function isContext(value: Context | Request): value is Context {
  return typeof (value as Context).req?.param === "function";
}

export async function applyShareGrantForArtifact(
  cookieHeader: string | null | undefined,
  artifactId: string | undefined,
  principal: Principal
): Promise<Principal> {
  if (!artifactId) {
    return principal;
  }

  const grant = await getShareLinkService().resolveCookieGrant(cookieHeader, artifactId);
  if (!grant) {
    return principal;
  }

  return {
    ...principal,
    artifactRoleGrants: {
      ...(principal.artifactRoleGrants ?? {}),
      [artifactId]: grant.role
    }
  };
}

async function resolveShareGrantPrincipal(c: Context, principal: Principal): Promise<Principal> {
  return applyShareGrantForArtifact(c.req.header("cookie"), c.req.param("artifactId"), principal);
}

export async function resolvePrincipal(c: Context | Request): Promise<Principal> {
  const request = isContext(c) ? c.req.raw : c;
  const apiKeyPrincipal = await getApiKeyPrincipalFromRequest(request);
  if (apiKeyPrincipal) {
    return isContext(c) ? resolveShareGrantPrincipal(c, apiKeyPrincipal) : apiKeyPrincipal;
  }

  const session = await getSessionFromRequest(request);

  let principal: Principal;
  if (session?.user) {
    principal = createUserPrincipal({
      userId: session.user.id,
      email: session.user.email,
      emailVerified: session.user.emailVerified
    });
  } else {
    principal = {
      type: "service",
      id: "anonymous-public-viewer",
      scopes: ["artifacts:read"]
    };
  }

  if (isContext(c)) {
    return resolveShareGrantPrincipal(c, principal);
  }

  return principal;
}

export async function requirePrincipal(c: Context | Request): Promise<Principal> {
  const request = isContext(c) ? c.req.raw : c;
  const apiKeyPrincipal = await getApiKeyPrincipalFromRequest(request);
  if (apiKeyPrincipal) {
    return isContext(c) ? resolveShareGrantPrincipal(c, apiKeyPrincipal) : apiKeyPrincipal;
  }

  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    throw new ArtifactForbiddenError("Authentication is required.");
  }

  const principal = createUserPrincipal({
    userId: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerified
  });

  if (isContext(c)) {
    return resolveShareGrantPrincipal(c, principal);
  }

  return principal;
}

type HumanPrincipal = Principal & { type: "user"; id: string };

export async function requireHumanPrincipal(c: Context | Request): Promise<HumanPrincipal> {
  const principal = await requirePrincipal(c);
  if (principal.type !== "user") {
    throw new ArtifactForbiddenError("User session required.");
  }
  return principal as HumanPrincipal;
}
