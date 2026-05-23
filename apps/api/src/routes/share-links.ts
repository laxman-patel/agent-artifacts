import type { Hono } from "hono";
import { z } from "zod";
import { getArtifactService, getAuditService, getShareLinkService } from "../deps.js";
import { artifactErrorResponse } from "../http/errors.js";
import { requireHumanPrincipal, requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerShareLinkRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.post("/api/artifacts/:artifactId/share-links", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const artifactId = c.req.param("artifactId");
      const body = z
        .object({
          role: z.enum(["viewer", "editor"]).default("viewer"),
          expiresAt: z.iso.datetime().optional()
        })
        .parse(await c.req.json());

      await getArtifactService().getArtifact(artifactId, principal);

      const canCreateLink = await getArtifactService().checkArtifactPermission(
        artifactId,
        "artifact.create_share_link",
        principal
      );
      if (!canCreateLink) {
        return c.json({ error: "forbidden", message: "Admin permission required." }, 403);
      }

      const created = await getShareLinkService().createShareLink({
        artifactId,
        role: body.role,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        createdByPrincipalType: principal.type,
        createdByPrincipalId: principal.id
      });

      return c.json(created, 201);
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

      const links = await getShareLinkService().listShareLinks(artifactId);

      return c.json({ shareLinks: links });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.post("/api/share-links/:shareLinkId/revoke", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const shareLinkId = c.req.param("shareLinkId");

      const link = await getShareLinkService().getShareLinkById(shareLinkId);

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

      await getShareLinkService().revokeShareLink(shareLinkId);

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
      const events = await getAuditService().listAuditEvents(principal.id, { artifactId, limit });

      return c.json({ events });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.get("/api/share/:token", async (c) => {
    try {
      const link = await getShareLinkService().resolveActiveShareLink(c.req.param("token"));

      const artifact = await getArtifactService().getArtifact(link.artifactId, {
        type: "service",
        id: `share_link:${link.id}`,
        scopes: ["artifacts:read"],
        artifactRoleGrants: { [link.artifactId]: link.role === "editor" ? "editor" : "viewer" }
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
}
