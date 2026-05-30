import type { Hono } from "hono";
import { z } from "zod";
import { getArtifactService, getAuditService, getShareLinkService, getWorkspaceAccess } from "../deps.js";
import { handle } from "../http/handler.js";
import { requireHumanPrincipal, requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

const auditEventsLimitSchema = z.coerce.number().int().positive().max(100).default(50);

export function registerShareLinkRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.post("/api/artifacts/:artifactId/share-links", (c) =>
    handle(c, async () => {
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

      return { body: created, status: 201 };
    })
  );

  app.get("/api/artifacts/:artifactId/share-links", (c) =>
    handle(c, async () => {
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

      return { shareLinks: links };
    })
  );

  app.post("/api/share-links/:shareLinkId/revoke", (c) =>
    handle(c, async () => {
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

      return { revoked: true };
    })
  );

  app.get("/api/audit-events", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const artifactId = c.req.query("artifactId");
      const workspaceId = c.req.query("workspaceId");
      const limit = auditEventsLimitSchema.parse(c.req.query("limit"));

      if (workspaceId) {
        await getWorkspaceAccess().assertAuthorized({
          principal,
          action: "workspace.manage_members",
          context: { workspaceId }
        });

        const events = await getAuditService().listAuditEvents({ workspaceId, artifactId, limit });
        return { events };
      }

      const events = await getAuditService().listAuditEvents({ ownerUserId: principal.id, artifactId, limit });

      return { events };
    })
  );

  app.get("/api/share/:token", (c) =>
    handle(c, async () => {
      const link = await getShareLinkService().resolveActiveShareLink(c.req.param("token"));

      const artifact = await getArtifactService().getArtifact(link.artifactId, {
        type: "service",
        id: `share_link:${link.id}`,
        scopes: ["artifacts:read"],
        artifactRoleGrants: { [link.artifactId]: link.role }
      });

      return {
        artifactId: link.artifactId,
        role: link.role,
        artifact
      };
    })
  );
}
