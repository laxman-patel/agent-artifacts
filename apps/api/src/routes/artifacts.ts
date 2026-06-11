import type { Hono } from "hono";
import { z } from "zod";
import {
  createArtifactInputSchema,
  restoreArtifactVersionInputSchema,
  setArtifactAccessInputSchema,
  updateArtifactInputSchema
} from "@agent-artifacts/artifact";
import { getArtifactService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal, resolvePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerArtifactRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/artifacts/slug-availability/:username/:projectSlug/:slug", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const result = await getArtifactService().checkSlugAvailability(
        c.req.param("username"),
        c.req.param("projectSlug"),
        c.req.param("slug"),
        principal
      );

      return {
        available: result.available,
        normalizedSlug: result.normalizedSlug,
        ownerUserId: result.ownerUserId,
        projectId: result.projectId
      };
    })
  );

  app.post("/api/artifacts", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = createArtifactInputSchema.parse(await c.req.json());
      const artifact = await getArtifactService().createArtifact(body, principal);

      return { body: artifact, status: 201 };
    })
  );

  app.get("/api/artifacts/:artifactId", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const artifact = await getArtifactService().getArtifact(c.req.param("artifactId"), principal);

      return artifact;
    })
  );

  app.get("/api/artifacts/:artifactId/permissions", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const artifactId = c.req.param("artifactId");

      return {
        canUpdate: await getArtifactService().checkArtifactPermission(artifactId, "artifact.update", principal),
        canRestore: await getArtifactService().checkArtifactPermission(artifactId, "artifact.restore", principal),
        canManageAccess: await getArtifactService().checkArtifactPermission(artifactId, "artifact.manage_access", principal)
      };
    })
  );

  app.delete("/api/artifacts/:artifactId", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const result = await getArtifactService().deleteArtifact(c.req.param("artifactId"), principal);

      return result;
    })
  );

  app.post("/api/artifacts/:artifactId/versions", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = updateArtifactInputSchema.parse({
        ...(await c.req.json()),
        artifactId: c.req.param("artifactId")
      });
      const version = await getArtifactService().updateArtifact(body, principal);

      return { body: version, status: 201 };
    })
  );

  app.post("/api/artifacts/:artifactId/versions/:versionNumber/restore", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = restoreArtifactVersionInputSchema.parse({
        artifactId: c.req.param("artifactId"),
        versionNumber: Number.parseInt(c.req.param("versionNumber"), 10)
      });
      const version = await getArtifactService().restoreArtifactVersion(body, principal);

      return { body: version, status: 201 };
    })
  );

  app.get("/api/artifacts/:artifactId/versions", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const limit = z.coerce.number().int().positive().max(100).default(50).parse(c.req.query("limit"));
      const versions = await getArtifactService().listArtifactVersions(c.req.param("artifactId"), principal, limit);

      return { versions };
    })
  );

  app.get("/api/artifacts/:artifactId/content", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const versionNumber = z.coerce.number().int().positive().optional().parse(c.req.query("version"));
      const result = await getArtifactService().getArtifactContent(c.req.param("artifactId"), principal, versionNumber);

      return {
        text: result.content,
        status: 200,
        headers: {
          "content-type": result.contentType,
          "x-content-type-options": "nosniff",
          "content-disposition": `inline; filename="artifact-${result.artifact.id}-v${result.version.versionNumber}"`,
          "x-artifact-id": result.artifact.id,
          "x-artifact-version": String(result.version.versionNumber)
        }
      };
    })
  );

  app.get("/api/artifacts/:artifactId/thumbnail", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const result = await getArtifactService().getArtifactThumbnail(c.req.param("artifactId"), principal);

      return {
        text: result.content,
        status: 200,
        headers: {
          "content-type": result.contentType,
          "x-content-type-options": "nosniff",
          "content-disposition": `inline; filename="artifact-${result.artifact.id}-thumbnail"`,
          "cache-control": "private, max-age=300",
          "x-artifact-id": result.artifact.id
        }
      };
    })
  );

  app.get("/api/artifacts/:artifactId/access", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const access = await getArtifactService().getArtifactAccess(c.req.param("artifactId"), principal);

      return access;
    })
  );

  app.patch("/api/artifacts/:artifactId/access", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = setArtifactAccessInputSchema.parse(await c.req.json());
      const access = await getArtifactService().setArtifactAccess(c.req.param("artifactId"), body, principal);

      return access;
    })
  );

  app.get("/api/artifacts/:artifactId/diff", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const fromVersion = z.coerce.number().int().positive().parse(c.req.query("from"));
      const toVersion = z.coerce.number().int().positive().parse(c.req.query("to"));
      const diffResult = await getArtifactService().diffArtifactVersions(
        c.req.param("artifactId"),
        principal,
        fromVersion,
        toVersion
      );

      return diffResult;
    })
  );
}
