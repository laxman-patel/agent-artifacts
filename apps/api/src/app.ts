import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { Context } from "hono";
import {
  ArtifactConflictError,
  ArtifactForbiddenError,
  ArtifactNotFoundError,
  ArtifactService,
  DrizzleArtifactRepository,
  SlugUnavailableError,
  createArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import {
  createApiKeyPrincipal,
  createAuth,
  createUserPrincipal,
  generateApiKeySecret,
  hashApiKeySecret,
  type BetterAuthHandle
} from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { agentIdentities, apiKeys, createDb, userProfiles, users, type Database } from "@agent-artifacts/db";
import { callMcpTool, listMcpTools, mcpToolInputSchemas, type McpToolName } from "@agent-artifacts/mcp";
import type { Principal } from "@agent-artifacts/shared";
import { agentScopeSchema, buildArtifactUrl, principalSchema, usernameSchema } from "@agent-artifacts/shared";
import { S3ArtifactStorage } from "@agent-artifacts/storage";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

export const app = new Hono();

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

    return new ArtifactService(new DrizzleArtifactRepository(db), storage, env.PUBLIC_APP_URL);
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

app.post("/mcp", async (c) => {
  try {
    const message = mcpJsonRpcRequestSchema.parse(await c.req.json());
    const result = await handleMcpJsonRpc(message, c.req.raw);

    return c.json({
      jsonrpc: "2.0",
      id: message.id,
      result
    });
  } catch (error) {
    return mcpErrorResponse(c, error);
  }
});

app.get("/api/artifacts/slug-availability/:username/:slug", async (c) => {
  try {
    const principal = await requirePrincipal(c.req.raw);
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
    const principal = await requirePrincipal(c.req.raw);
    const body = createArtifactInputSchema.parse(await c.req.json());
    const artifact = await getArtifactService().createArtifact(body, principal);

    return c.json(artifact, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId", async (c) => {
  try {
    const principal = await resolvePrincipal(c.req.raw);
    const artifact = await getArtifactService().getArtifact(c.req.param("artifactId"), principal);

    return c.json(artifact);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/artifacts/:artifactId/versions", async (c) => {
  try {
    const principal = await requirePrincipal(c.req.raw);
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
    const principal = await resolvePrincipal(c.req.raw);
    const limit = z.coerce.number().int().positive().max(100).default(50).parse(c.req.query("limit"));
    const versions = await getArtifactService().listArtifactVersions(c.req.param("artifactId"), principal, limit);

    return c.json({ versions });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/content", async (c) => {
  try {
    const principal = await resolvePrincipal(c.req.raw);
    const versionNumber = z.coerce.number().int().positive().optional().parse(c.req.query("version"));
    const result = await getArtifactService().getArtifactContent(c.req.param("artifactId"), principal, versionNumber);

    return c.text(result.content, 200, {
      "content-type": result.contentType,
      "x-artifact-id": result.artifact.id,
      "x-artifact-version": String(result.version.versionNumber)
    });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/access", async (c) => {
  try {
    const principal = await requirePrincipal(c.req.raw);
    const access = await getArtifactService().getArtifactAccess(c.req.param("artifactId"), principal);

    return c.json(access);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.patch("/api/artifacts/:artifactId/access", async (c) => {
  try {
    const principal = await requirePrincipal(c.req.raw);
    const body = setArtifactAccessInputSchema.parse(await c.req.json());
    const access = await getArtifactService().setArtifactAccess(c.req.param("artifactId"), body, principal);

    return c.json(access);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/diff", async (c) => {
  try {
    const principal = await resolvePrincipal(c.req.raw);
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
    const principal = await requirePrincipal(c.req.raw);
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
    const principal = await requirePrincipal(c.req.raw);
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
    const principal = await requirePrincipal(c.req.raw);
    const artifacts = await getArtifactService().listOwnedArtifacts(principal);

    return c.json({ artifacts });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/agents", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c.req.raw);
    const db = getDb();
    const agents = await db
      .select({
        id: agentIdentities.id,
        displayName: agentIdentities.displayName,
        defaultRole: agentIdentities.defaultRole,
        scopes: agentIdentities.scopes,
        lastUsedAt: agentIdentities.lastUsedAt,
        revokedAt: agentIdentities.revokedAt,
        createdAt: agentIdentities.createdAt
      })
      .from(agentIdentities)
      .where(eq(agentIdentities.ownerUserId, principal.id));

    return c.json({ agents });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/agents", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c.req.raw);
    const body = z
      .object({
        displayName: z.string().min(1).max(120),
        scopes: z.array(agentScopeSchema).default(["artifacts:read"]),
        defaultRole: z.enum(["viewer", "editor", "admin"]).default("viewer")
      })
      .parse(await c.req.json());

    const agentId = randomUUID();
    await getDb().insert(agentIdentities).values({
      id: agentId,
      ownerUserId: principal.id,
      displayName: body.displayName,
      createdByUserId: principal.id,
      defaultRole: body.defaultRole,
      scopes: body.scopes,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return c.json({ agentId }, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/agents/:agentId/revoke", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c.req.raw);
    await getDb()
      .update(agentIdentities)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(agentIdentities.id, c.req.param("agentId")), eq(agentIdentities.ownerUserId, principal.id)));

    return c.json({ revoked: true });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/api-keys", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c.req.raw);
    const keys = await getDb()
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt
      })
      .from(apiKeys)
      .where(eq(apiKeys.ownerUserId, principal.id));

    return c.json({ apiKeys: keys });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/api-keys", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c.req.raw);
    const body = z
      .object({
        name: z.string().min(1).max(120),
        scopes: z.array(agentScopeSchema).default(["artifacts:read"])
      })
      .parse(await c.req.json());

    const keyId = randomUUID();
    const secret = generateApiKeySecret();
    await getDb().insert(apiKeys).values({
      id: keyId,
      ownerUserId: principal.id,
      name: body.name,
      keyHash: hashApiKeySecret(secret),
      scopes: body.scopes,
      createdByUserId: principal.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    return c.json({ apiKeyId: keyId, secret }, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/api-keys/:apiKeyId/revoke", async (c) => {
  try {
    const principal = await requireHumanPrincipal(c.req.raw);
    await getDb()
      .update(apiKeys)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(apiKeys.id, c.req.param("apiKeyId")), eq(apiKeys.ownerUserId, principal.id)));

    return c.json({ revoked: true });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/by-path/:username/:slug", async (c) => {
  try {
    const principal = await resolvePrincipal(c.req.raw);
    const artifact = await getArtifactService().getArtifactByPath(c.req.param("username"), c.req.param("slug"), principal);

    return c.json(artifact);
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

async function resolvePrincipal(request: Request): Promise<Principal> {
  const headerPrincipal = readPrincipal(request.headers);
  if (headerPrincipal) {
    return headerPrincipal;
  }

  const apiKeyPrincipal = await readApiKeyPrincipal(request.headers);
  if (apiKeyPrincipal) {
    return apiKeyPrincipal;
  }

  const session = await getAuth().api.getSession({
    headers: request.headers
  });

  if (session?.user) {
    return createUserPrincipal({
      userId: session.user.id,
      email: session.user.email
    });
  }

  return {
    type: "service",
    id: "anonymous-public-viewer",
    scopes: []
  };
}

async function requirePrincipal(request: Request): Promise<Principal> {
  const headerPrincipal = readPrincipal(request.headers);
  if (headerPrincipal) {
    return headerPrincipal;
  }

  const apiKeyPrincipal = await readApiKeyPrincipal(request.headers);
  if (apiKeyPrincipal) {
    return apiKeyPrincipal;
  }

  const session = await getAuth().api.getSession({
    headers: request.headers
  });

  if (session?.user) {
    return createUserPrincipal({
      userId: session.user.id,
      email: session.user.email
    });
  }

  throw new ArtifactForbiddenError("Authentication is required.");
}

type HumanPrincipal = Principal & { type: "user"; id: string };

async function requireHumanPrincipal(request: Request): Promise<HumanPrincipal> {
  const principal = await requirePrincipal(request);
  if (principal.type !== "user") {
    throw new ArtifactForbiddenError("User session required.");
  }

  return principal as HumanPrincipal;
}

function readPrincipal(headers: Headers): Principal | undefined {
  const id = headers.get("x-principal-id");
  const type = headers.get("x-principal-type") ?? "user";
  if (!id) {
    return undefined;
  }

  return principalSchema.parse({
    id,
    type,
    ownerUserId: headers.get("x-principal-owner-user-id") ?? undefined,
    email: headers.get("x-principal-email") ?? undefined,
    scopes: headers
      .get("x-principal-scopes")
      ?.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean)
  });
}

async function readApiKeyPrincipal(headers: Headers): Promise<Principal | undefined> {
  const authorization = headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) {
    return undefined;
  }

  const keyHash = hashApiKeySecret(match[1]);
  const [key] = await getDb()
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);

  if (!key) {
    return undefined;
  }

  await getDb().update(apiKeys).set({ lastUsedAt: new Date(), updatedAt: new Date() }).where(eq(apiKeys.id, key.id));

  return createApiKeyPrincipal({
    apiKeyId: key.id,
    ownerUserId: key.ownerUserId,
    scopes: key.scopes
  });
}

const mcpJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1),
  params: z.unknown().optional()
});

type McpJsonRpcRequest = z.infer<typeof mcpJsonRpcRequestSchema>;

async function handleMcpJsonRpc(message: McpJsonRpcRequest, request: Request): Promise<unknown> {
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

      const principal = await requirePrincipal(request);
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
