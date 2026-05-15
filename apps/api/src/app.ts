import { Hono } from "hono";
import type { Context } from "hono";
import {
  ArtifactConflictError,
  ArtifactForbiddenError,
  ArtifactNotFoundError,
  ArtifactService,
  DrizzleArtifactRepository,
  SlugUnavailableError,
  createArtifactInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import { createAuth } from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { createDb } from "@agent-artifacts/db";
import type { Principal } from "@agent-artifacts/shared";
import { buildArtifactUrl, principalSchema } from "@agent-artifacts/shared";
import { S3ArtifactStorage } from "@agent-artifacts/storage";
import { z } from "zod";

export const app = new Hono();

let authInstance: ReturnType<typeof createAuth> | undefined;
let artifactServiceInstance: ArtifactService | undefined;

function getAuth() {
  authInstance ??= (() => {
    const env = loadServerEnv();
    const db = createDb({
      connectionString: env.DATABASE_URL
    });

    return createAuth({
      database: db,
      secret: env.BETTER_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET
    });
  })();

  return authInstance;
}

function getArtifactService() {
  artifactServiceInstance ??= (() => {
    const env = loadServerEnv();
    const db = createDb({
      connectionString: env.DATABASE_URL
    });
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

app.get("/api/artifacts/slug-availability/:username/:slug", async (c) => {
  try {
    const principal = requirePrincipal(c.req.raw.headers);
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
    const principal = requirePrincipal(c.req.raw.headers);
    const body = createArtifactInputSchema.parse(await c.req.json());
    const artifact = await getArtifactService().createArtifact(body, principal);

    return c.json(artifact, 201);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId", async (c) => {
  try {
    const principal = resolvePrincipal(c.req.raw.headers);
    const artifact = await getArtifactService().getArtifact(c.req.param("artifactId"), principal);

    return c.json(artifact);
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.post("/api/artifacts/:artifactId/versions", async (c) => {
  try {
    const principal = requirePrincipal(c.req.raw.headers);
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
    const principal = resolvePrincipal(c.req.raw.headers);
    const limit = z.coerce.number().int().positive().max(100).default(50).parse(c.req.query("limit"));
    const versions = await getArtifactService().listArtifactVersions(c.req.param("artifactId"), principal, limit);

    return c.json({ versions });
  } catch (error) {
    return artifactErrorResponse(c, error);
  }
});

app.get("/api/artifacts/:artifactId/content", async (c) => {
  try {
    const principal = resolvePrincipal(c.req.raw.headers);
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

app.get("/:username/:slug", async (c) => {
  try {
    const principal = resolvePrincipal(c.req.raw.headers);
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

function resolvePrincipal(headers: Headers): Principal {
  const principal = readPrincipal(headers);
  if (principal) {
    return principal;
  }

  return {
    type: "service",
    id: "anonymous-public-viewer",
    scopes: []
  };
}

function requirePrincipal(headers: Headers): Principal {
  const principal = readPrincipal(headers);
  if (!principal) {
    throw new ArtifactForbiddenError("Authentication is required.");
  }

  return principal;
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
