import type { Hono } from "hono";
import { z } from "zod";
import { createWorkspaceInvitationInputSchema } from "@agent-artifacts/workspace";
import { getInvitationService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerWorkspaceInvitationRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.post("/api/workspaces/:workspaceId/invitations", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = createWorkspaceInvitationInputSchema.parse(await c.req.json());
      const invitation = await getInvitationService().createInvitation(
        c.req.param("workspaceId"),
        body.email,
        body.role,
        principal
      );

      return { body: { invitation }, status: 201 };
    })
  );

  app.get("/api/workspaces/:workspaceId/invitations", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const invitations = await getInvitationService().listPendingInvitations(
        c.req.param("workspaceId"),
        principal
      );

      return { body: { invitations } };
    })
  );

  app.post("/api/workspace-invitations/accept", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = z
        .object({
          token: z.string().min(1)
        })
        .parse(await c.req.json());
      const membership = await getInvitationService().acceptInvitation(body.token, principal);

      return { body: { membership } };
    })
  );

  app.post("/api/workspace-invitations/:invitationId/revoke", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      await getInvitationService().revokeInvitation(c.req.param("invitationId"), principal);

      return { body: { revoked: true } };
    })
  );

  app.post("/api/workspace-invitations/:invitationId/resend", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const invitation = await getInvitationService().resendInvitation(c.req.param("invitationId"), principal);

      return { body: { invitation } };
    })
  );
}
