import type { Hono } from "hono";
import { z } from "zod";
import {
  createArtifactInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import { getArtifactService } from "../deps.js";
import { artifactErrorResponse } from "../http/errors.js";
import { requirePrincipal, resolvePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerArtifactRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/artifacts/slug-availability/:username/:projectSlug/:slug", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const result = await getArtifactService().checkSlugAvailability(
        c.req.param("username"),
        c.req.param("projectSlug"),
        c.req.param("slug"),
        principal
      );

      return c.json({
        available: result.available,
        normalizedSlug: result.normalizedSlug,
        ownerUserId: result.ownerUserId,
        projectId: result.projectId
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
}
