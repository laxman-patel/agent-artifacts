import type { Context } from "hono";
import { createUserPrincipal } from "@agent-artifacts/auth";
import { ArtifactForbiddenError, type Principal } from "@agent-artifacts/shared";
import { getAuth, getDb } from "../deps.js";
import { resolveShareGrant } from "../share-session.js";

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

function isContext(value: Context | Request): value is Context {
  return typeof (value as Context).req?.param === "function";
}

async function resolveShareGrantPrincipal(c: Context, principal: Principal): Promise<Principal> {
  const artifactId = c.req.param("artifactId");
  if (!artifactId) {
    return principal;
  }

  const grant = await resolveShareGrant(getDb(), c.req.raw, artifactId);
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

export async function resolvePrincipal(c: Context | Request): Promise<Principal> {
  const request = isContext(c) ? c.req.raw : c;
  const session = await getSessionFromRequest(request);

  let principal: Principal;
  if (session?.user) {
    principal = createUserPrincipal({
      userId: session.user.id,
      email: session.user.email
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
  const session = await getSessionFromRequest(request);

  if (!session?.user) {
    throw new ArtifactForbiddenError("Authentication is required.");
  }

  const principal = createUserPrincipal({
    userId: session.user.id,
    email: session.user.email
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
