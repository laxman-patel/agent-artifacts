import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { rateLimit } from "./rate-limit.js";
import { logger } from "./logger.js";
import { csrfOriginGuard } from "./csrf.js";
import { resolveShareGrant } from "./share-session.js";
import { createArtifactAccess } from "@agent-artifacts/access";
import {
  ArtifactConflictError,
  ArtifactNotFoundError,
  ArtifactService,
  DrizzleArtifactRepository,
  DrizzleArtifactRoleResolver,
  MAX_ARTIFACT_CONTENT_BYTES,
  SlugUnavailableError,
  createArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import {
  createAuth,
  createUserPrincipal,
  withMcpAuth,
  type BetterAuthHandle
} from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { auditEvents, createDb, shareLinks, userProfiles, users, type Database } from "@agent-artifacts/db";
import { callMcpTool, listMcpTools, mcpToolInputSchemas, type McpToolName } from "@agent-artifacts/mcp";
import { ArtifactForbiddenError, type Principal } from "@agent-artifacts/shared";
import { buildArtifactUrl, usernameSchema } from "@agent-artifacts/shared";
import { S3ArtifactStorage } from "@agent-artifacts/storage";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export const app = new Hono();

app.use("*", async (c, next) => {
  const requestId = randomUUID();
  const start = Date.now();
  c.set("requestId" as never, requestId);
  c.header("x-request-id", requestId);

  await next();

  const duration = Date.now() - start;
  c.header("x-content-type-options", "nosniff");
  c.header("x-frame-options", "DENY");
  c.header("referrer-policy", "strict-origin-when-cross-origin");

  logger.info("request", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: duration
  });
});

const writeLimiter = rateLimit({ windowMs: 60_000, max: 60 });
const readLimiter = rateLimit({ windowMs: 60_000, max: 300 });

// HTTP-layer body limit. Higher than MAX_ARTIFACT_CONTENT_BYTES to allow
// for the JSON envelope around content (title, slug, etc).
const HTTP_BODY_LIMIT_BYTES = MAX_ARTIFACT_CONTENT_BYTES + 64 * 1024;
const artifactBodyLimit = bodyLimit({
  maxSize: HTTP_BODY_LIMIT_BYTES,
  onError: (c) => c.json({ error: "payload_too_large", message: `Body exceeds ${HTTP_BODY_LIMIT_BYTES} byte limit.` }, 413)
});

// CSRF: applied broadly to /api/* mutations. Bearer-authed requests skip it,
// so MCP/CLI clients with Authorization: Bearer ... are unaffected.
// Wrapped lazily so env validation errors don't prevent the module from loading.
const csrfGuard: MiddlewareHandler = async (c, next) => {
  csrfGuardImpl ??= csrfOriginGuard([loadServerEnv().PUBLIC_APP_URL, loadServerEnv().BETTER_AUTH_URL]);
  return csrfGuardImpl(c, next);
};
let csrfGuardImpl: MiddlewareHandler | undefined;

app.use("/api/artifacts", writeLimiter, artifactBodyLimit, csrfGuard);
app.use("/api/artifacts/:id", csrfGuard);
app.use("/api/artifacts/:id/versions", writeLimiter, artifactBodyLimit, csrfGuard);
app.use("/api/artifacts/:id/access", csrfGuard);
app.use("/api/artifacts/:id/share-links", writeLimiter, csrfGuard);
app.use("/api/share-links/:id/revoke", writeLimiter, csrfGuard);
app.use("/api/profile/username", csrfGuard);
app.use("/api/artifacts/*", readLimiter);
app.use("/mcp", writeLimiter, artifactBodyLimit);

let authInstance: BetterAuthHandle | undefined;
let artifactServiceInstance: ArtifactService | undefined;
let dbInstance: Database | undefined;

function getDb() {
  dbInstance ??= createDb({
    connectionString: loadServerEnv().DATABASE_URL
  });

  return dbInstance;
}

function getAuth() {
  authInstance ??= (() => {
    const env = loadServerEnv();
    const db = getDb();

    return createAuth({
      database: db,
      secret: env.BETTER_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
      webOrigin: env.PUBLIC_APP_URL,
      trustedOrigins: [env.BETTER_AUTH_URL, env.PUBLIC_APP_URL],
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET
    });
  })();

  return authInstance;
}

function getArtifactService() {
  artifactServiceInstance ??= (() => {
    const env = loadServerEnv();
    const db = getDb();
    const storage = new S3ArtifactStorage({
      endpoint: env.S3_ENDPOINT,
      bucket: env.S3_BUCKET,
      region: env.S3_REGION,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    });

    const roleResolver = new DrizzleArtifactRoleResolver(db);
    return new ArtifactService(
      new DrizzleArtifactRepository(db),
      storage,
      env.PUBLIC_APP_URL,
      createArtifactAccess(roleResolver)
    );
  })();

  return artifactServiceInstance;
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "agent-artifacts-api"
  })
);

app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));

// MCP endpoint authenticated through Better Auth's MCP OAuth flow.
// Unauthenticated requests receive 401 with WWW-Authenticate pointing at
// /api/auth/.well-known/oauth-protected-resource so MCP clients can
// auto-discover the OAuth dance.
//
// The unauthenticated "initialize" and "tools/list" probes that some clients
// make are short-circuited to return the discovery payload without auth so
// they can introspect the server before initiating the OAuth flow.
app.post("/mcp", async (c) => {
  try {
    // Unauthenticated peek: allow initialize / tools/list without an access token.
    const clonedBody = await c.req.raw.clone().text();
    let peekedMethod: string | undefined;
    try {
      const parsed = JSON.parse(clonedBody) as { method?: string };
      peekedMethod = parsed.method;
    } catch {
      // fall through to authenticated path
    }

    if (peekedMethod === "initialize" || peekedMethod === "tools/list") {
      const message = mcpJsonRpcRequestSchema.parse(JSON.parse(clonedBody));
      const result = await handleMcpJsonRpc(message, null);
      return c.json({ jsonrpc: "2.0", id: message.id, result });
    }

    const handler = withMcpAuth(getAuth() as never, async (req: Request, session: { userId: string }) => {
      try {
        const message = mcpJsonRpcRequestSchema.parse(await req.json());
        const [userRow] = await getDb()
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        if (!userRow) {
          return Response.json(
            { jsonrpc: "2.0", id: message.id ?? null, error: { code: -32001, message: "Authenticated user not found." } },
            { status: 200 }
          );
        }

        const principal = createUserPrincipal({ userId: userRow.id, email: userRow.email });
        const result = await handleMcpJsonRpc(message, principal);
        return Response.json({ jsonrpc: "2.0", id: message.id, result });
      } catch (error) {
        return mcpErrorAsResponse(error);
      }
    });

    return handler(c.req.raw);
  } catch (error) {
    return mcpErrorResponse(c, error);
  }
});

// OAuth protected resource metadata: tells MCP clients where to find the
// authorization server. Mounted explicitly so it's reachable without
// `/api/auth/*` proxying — the mcp() Better Auth plugin's helper handles it.
app.get("/.well-known/oauth-protected-resource", (c) =>
  c.json({
    resource: loadServerEnv().PUBLIC_APP_URL,
    authorization_servers: [loadServerEnv().BETTER_AUTH_URL],
    scopes_supported: ["openid", "profile", "email"],
    bearer_methods_supported: ["header"]
  })
);

app.get("/api/artifacts/slug-availability/:username/:slug", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const result = await getArtifactService().checkSlugAvailability(c.req.param("username"), c.req.param("slug"), principal);

    return c.json({
      available: result.available,
      normalizedSlug: result.normalizedSlug,
      ownerUserId: result.ownerUserId
    });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/artifacts", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const body = createArtifactInputSchema.parse(await c.req.json());
    const artifact = await getArtifactService().createArtifact(body, principal);

    return c.json(artifact, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId", async (c) => {
  try {
    const principal = await resolvePrincipal(c);
    const artifact = await getArtifactService().getArtifact(c.req.param("artifactId"), principal);

    return c.json(artifact);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.delete("/api/artifacts/:artifactId", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const result = await getArtifactService().deleteArtifact(c.req.param("artifactId"), principal);

    return c.json(result);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/artifacts/:artifactId/versions", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const body = updateArtifactInputSchema.parse({
      ...(await c.req.json()),
      artifactId: c.req.param("artifactId")
    });
    const version = await getArtifactService().updateArtifact(body, principal);

    return c.json(version, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/versions", async (c) => {
  try {
    const principal = await resolvePrincipal(c);
    const limit = z.coerce.number().int().positive().max(100).default(50).parse(c.req.query("limit"));
    const versions = await getArtifactService().listArtifactVersions(c.req.param("artifactId"), principal, limit);

    return c.json({ versions });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/content", async (c) => {
  try {
    const principal = await resolvePrincipal(c);
    const versionNumber = z.coerce.number().int().positive().optional().parse(c.req.query("version"));
    const result = await getArtifactService().getArtifactContent(c.req.param("artifactId"), principal, versionNumber);

    return c.text(result.content, 200, {
      "content-type": result.contentType,
      "x-content-type-options": "nosniff",
      "content-disposition": `inline; filename="artifact-${result.artifact.id}-v${result.version.versionNumber}"`,
      "x-artifact-id": result.artifact.id,
      "x-artifact-version": String(result.version.versionNumber)
    });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/access", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const access = await getArtifactService().getArtifactAccess(c.req.param("artifactId"), principal);

    return c.json(access);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.patch("/api/artifacts/:artifactId/access", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const body = setArtifactAccessInputSchema.parse(await c.req.json());
    const access = await getArtifactService().setArtifactAccess(c.req.param("artifactId"), body, principal);

    return c.json(access);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/diff", async (c) => {
  try {
    const principal = await resolvePrincipal(c);
    const fromVersion = z.coerce.number().int().positive().parse(c.req.query("from"));
    const toVersion = z.coerce.number().int().positive().parse(c.req.query("to"));
    const diffResult = await getArtifactService().diffArtifactVersions(
      c.req.param("artifactId"),
      principal,
      fromVersion,
      toVersion
    );

    return c.json(diffResult);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/profile/me", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    if (principal.type !== "user") {
      return c.json({ error: "forbidden", message: "User session required." }, 403);
    }

    const db = getDb();
    const [userRow] = await db.select().from(users).where(eq(users.id, principal.id)).limit(1);

    if (!userRow) {
      return c.json({ error: "not_found", message: "User was not found." }, 404);
    }

    const [profileRow] = await db.select().from(userProfiles).where(eq(userProfiles.userId, principal.id)).limit(1);

    return c.json({
      user: {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        image: userRow.image,
        emailVerified: userRow.emailVerified
      },
      profile: profileRow
        ? {
            username: profileRow.username,
            displayName: profileRow.displayName,
            createdAt: profileRow.createdAt,
            updatedAt: profileRow.updatedAt
          }
        : null
    });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/profile/username", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    if (principal.type !== "user") {
      return c.json({ error: "forbidden", message: "User session required." }, 403);
    }

    const body = z.object({ username: usernameSchema }).parse(await c.req.json());
    const db = getDb();

    const [existingProfile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, principal.id)).limit(1);

    if (existingProfile) {
      return c.json({ error: "conflict", message: "Username is already set for this account." }, 409);
    }

    const [userRow] = await db.select().from(users).where(eq(users.id, principal.id)).limit(1);

    if (!userRow) {
      return c.json({ error: "not_found", message: "User was not found." }, 404);
    }

    const normalizedUsername = body.username.trim().toLowerCase();

    const [usernameTaken] = await db
      .select({ userId: userProfiles.userId })
      .from(userProfiles)
      .where(sql`lower(${userProfiles.username}) = ${normalizedUsername}`)
      .limit(1);

    if (usernameTaken) {
      return c.json({ error: "conflict", message: "That username is already taken." }, 409);
    }

    await db.insert(userProfiles).values({
      userId: principal.id,
      username: normalizedUsername,
      displayName: userRow.name ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return c.json({ username: normalizedUsername }, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/profile/artifacts", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const artifacts = await getArtifactService().listOwnedArtifacts(principal);

    return c.json({ artifacts });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/by-path/:username/:slug", async (c) => {
  try {
    const principal = await resolvePrincipal(c);
    const artifact = await getArtifactService().getArtifactByPath(c.req.param("username"), c.req.param("slug"), principal);

    return c.json(artifact);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/artifacts/:artifactId/share-links", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const artifactId = c.req.param("artifactId");
    const body = z
      .object({
        role: z.enum(["viewer", "editor"]).default("viewer"),
        expiresAt: z.string().datetime().optional()
      })
      .parse(await c.req.json());

    const artifact = await getArtifactService().getArtifact(artifactId, principal);
    if (!artifact) {
      return c.json({ error: "not_found", message: "Artifact not found." }, 404);
    }

    const canCreateLink = await getArtifactService().checkArtifactPermission(
      artifactId,
      "artifact.create_share_link",
      principal
    );
    if (!canCreateLink) {
      return c.json({ error: "forbidden", message: "Admin permission required." }, 403);
    }

    const token = generateShareToken();
    const tokenHash = hashShareToken(token);
    const linkId = randomUUID();
    const db = getDb();

    await db.insert(shareLinks).values({
      id: linkId,
      artifactId,
      tokenHash,
      role: body.role,
      createdByPrincipalType: principal.type,
      createdByPrincipalId: principal.id,
      createdAt: new Date(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null
    });

    const env = loadServerEnv();
    return c.json(
      {
        id: linkId,
        shareUrl: `${env.PUBLIC_APP_URL}/share/${token}`,
        role: body.role,
        expiresAt: body.expiresAt ?? null
      },
      201
    );
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/share-links", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const artifactId = c.req.param("artifactId");

    const canListLinks = await getArtifactService().checkArtifactPermission(
      artifactId,
      "artifact.create_share_link",
      principal
    );
    if (!canListLinks) {
      return c.json({ error: "forbidden", message: "Admin permission required." }, 403);
    }

    const links = await getDb()
      .select({
        id: shareLinks.id,
        role: shareLinks.role,
        createdAt: shareLinks.createdAt,
        expiresAt: shareLinks.expiresAt,
        revokedAt: shareLinks.revokedAt,
        lastUsedAt: shareLinks.lastUsedAt
      })
      .from(shareLinks)
      .where(eq(shareLinks.artifactId, artifactId));

    return c.json({ shareLinks: links });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/share-links/:shareLinkId/revoke", async (c) => {
  try {
    const principal = await requirePrincipal(c);
    const shareLinkId = c.req.param("shareLinkId");

    const [link] = await getDb()
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.id, shareLinkId))
      .limit(1);

    if (!link) {
      return c.json({ error: "not_found", message: "Share link not found." }, 404);
    }

    const canRevoke = await getArtifactService().checkArtifactPermission(
      link.artifactId,
      "artifact.revoke_share_link",
      principal
    );
    if (!canRevoke) {
      return c.json({ error: "forbidden", message: "Admin permission required." }, 403);
    }

    await getDb()
      .update(shareLinks)
      .set({ revokedAt: new Date() })
      .where(eq(shareLinks.id, shareLinkId));

    return c.json({ revoked: true });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/audit-events", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c);
    const artifactId = c.req.query("artifactId");
    const limit = z.coerce.number().int().positive().max(100).default(50).parse(c.req.query("limit"));
    const db = getDb();

    const conditions = [eq(auditEvents.ownerUserId, principal.id)];
    if (artifactId) {
      conditions.push(eq(auditEvents.artifactId, artifactId));
    }

    const events = await db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.createdAt))
      .limit(limit);

    return c.json({ events });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/share/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const tokenHash = hashShareToken(token);

    const [link] = await getDb()
      .select()
      .from(shareLinks)
      .where(
        and(
          eq(shareLinks.tokenHash, tokenHash),
          isNull(shareLinks.revokedAt)
        )
      )
      .limit(1);

    if (!link) {
      return c.json({ error: "not_found", message: "Share link not found or revoked." }, 404);
    }

    if (link.expiresAt && link.expiresAt < new Date()) {
      return c.json({ error: "gone", message: "Share link has expired." }, 410);
    }

    await getDb()
      .update(shareLinks)
      .set({ lastUsedAt: new Date() })
      .where(eq(shareLinks.id, link.id));

    const artifact = await getArtifactService().getArtifact(link.artifactId, {
      type: "service",
      id: `share_link:${link.id}`,
      scopes: []
    });

    return c.json({
      artifactId: link.artifactId,
      role: link.role,
      artifact
    });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/slug-preview/:username/:slug", (c) => {
  const username = c.req.param("username");
  const slug = c.req.param("slug");
  const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";

  return c.json({
    url: buildArtifactUrl(appUrl, username, slug)
  });
});

function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function resolvePrincipal(c: Context | Request): Promise<Principal> {
  const request = isContext(c) ? c.req.raw : c;
  const session = await getAuth().api.getSession({ headers: request.headers });

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
      scopes: []
    };
  }

  if (isContext(c)) {
    await attachShareGrant(c, principal);
  }

  return principal;
}

async function requirePrincipal(c: Context | Request): Promise<Principal> {
  const request = isContext(c) ? c.req.raw : c;
  const session = await getAuth().api.getSession({ headers: request.headers });

  if (!session?.user) {
    throw new ArtifactForbiddenError("Authentication is required.");
  }

  const principal = createUserPrincipal({
    userId: session.user.id,
    email: session.user.email
  });

  if (isContext(c)) {
    await attachShareGrant(c, principal);
  }

  return principal;
}

type HumanPrincipal = Principal & { type: "user"; id: string };

async function requireHumanPrincipal(c: Context | Request): Promise<HumanPrincipal> {
  const principal = await requirePrincipal(c);
  if (principal.type !== "user") {
    throw new ArtifactForbiddenError("User session required.");
  }
  return principal as HumanPrincipal;
}

function isContext(value: Context | Request): value is Context {
  return typeof (value as Context).req?.param === "function";
}

async function attachShareGrant(c: Context, principal: Principal): Promise<void> {
  const artifactId = c.req.param("artifactId");
  if (!artifactId) return;

  const grant = await resolveShareGrant(getDb(), c.req.raw, artifactId);
  if (!grant) return;

  principal.artifactRoleGrants = {
    ...(principal.artifactRoleGrants ?? {}),
    [artifactId]: grant.role
  };
}

const mcpJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional()
});

type McpJsonRpcRequest = z.infer<typeof mcpJsonRpcRequestSchema>;

async function handleMcpJsonRpc(message: McpJsonRpcRequest, principal: Principal | null): Promise<unknown> {
  switch (message.method) {
    case "initialize":
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: "agent-artifacts",
          version: "0.1.0"
        }
      };
    case "tools/list":
      return {
        tools: listMcpTools()
      };
    case "tools/call": {
      const params = z
        .object({
          name: z.string().min(1),
          arguments: z.unknown().optional()
        })
        .parse(message.params);

      if (!isMcpToolName(params.name)) {
        throw new McpJsonRpcError(-32601, `Unknown MCP tool: ${params.name}`);
      }

      if (!principal) {
        throw new McpJsonRpcError(-32001, "Authentication required for tools/call");
      }

      const result = await callMcpTool(params.name, params.arguments ?? {}, {
        artifactService: getArtifactService(),
        principal
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ],
        structuredContent: result
      };
    }
    default:
      throw new McpJsonRpcError(-32601, `Unknown MCP method: ${message.method}`);
  }
}

function isMcpToolName(name: string): name is McpToolName {
  return name in mcpToolInputSchemas;
}

class McpJsonRpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message);
    this.name = "McpJsonRpcError";
  }
}

function mcpErrorAsResponse(error: unknown): Response {
  const payload = mcpErrorPayload(error);
  return Response.json(payload, { status: 200 });
}

function mcpErrorPayload(error: unknown): { jsonrpc: "2.0"; id: null; error: { code: number; message: string; data?: unknown } } {
  if (error instanceof McpJsonRpcError) {
    return { jsonrpc: "2.0", id: null, error: { code: error.code, message: error.message } };
  }
  if (error instanceof z.ZodError) {
    return { jsonrpc: "2.0", id: null, error: { code: -32602, message: "Invalid MCP request.", data: error.issues } };
  }
  if (error instanceof ArtifactForbiddenError) {
    return { jsonrpc: "2.0", id: null, error: { code: -32001, message: error.message } };
  }
  if (error instanceof ArtifactNotFoundError) {
    return { jsonrpc: "2.0", id: null, error: { code: -32004, message: error.message } };
  }
  if (error instanceof SlugUnavailableError || error instanceof ArtifactConflictError) {
    return { jsonrpc: "2.0", id: null, error: { code: -32009, message: error.message } };
  }
  return { jsonrpc: "2.0", id: null, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } };
}

function mcpErrorResponse(c: Context, error: unknown) {
  if (error instanceof McpJsonRpcError) {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: error.code,
          message: error.message
        }
      },
      200
    );
  }

  if (error instanceof z.ZodError) {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32602,
          message: "Invalid MCP request.",
          data: error.issues
        }
      },
      200
    );
  }

  if (error instanceof ArtifactForbiddenError) {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32001,
          message: error.message
        }
      },
      200
    );
  }

  if (error instanceof ArtifactNotFoundError) {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32004,
          message: error.message
        }
      },
      200
    );
  }

  if (error instanceof SlugUnavailableError || error instanceof ArtifactConflictError) {
    return c.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32009,
          message: error.message
        }
      },
      200
    );
  }

  throw error;
}

function artifactErrorResponse(c: Context, error: unknown) {
  if (error instanceof ArtifactNotFoundError) {
    return c.json({ error: "not_found", message: error.message }, 404);
  }

  if (error instanceof ArtifactForbiddenError) {
    return c.json({ error: "forbidden", message: error.message }, 403);
  }

  if (error instanceof SlugUnavailableError || error instanceof ArtifactConflictError) {
    return c.json({ error: "conflict", message: error.message }, 409);
  }

  if (error instanceof z.ZodError) {
    return c.json({ error: "invalid_request", issues: error.issues }, 400);
  }

  throw error;
}
