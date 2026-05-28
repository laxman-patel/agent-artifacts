import type { Hono } from "hono";
import { createTeamWorkspaceInputSchema, changeMemberRoleInputSchema } from "@agent-artifacts/workspace";
import { getMembershipService, getWorkspaceService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerWorkspaceRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/workspaces", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const workspaces = await getWorkspaceService().listWorkspacesForUser(principal);

      return { body: { workspaces } };
    })
  );

  app.get("/api/workspaces/slug-availability/:slug", (c) =>
    handle(c, async () => {
      await requirePrincipal(c);
      const result = await getWorkspaceService().checkSlugAvailability(c.req.param("slug"));

      return result;
    })
  );

  app.post("/api/workspaces", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = createTeamWorkspaceInputSchema.parse(await c.req.json());
      const workspace = await getWorkspaceService().createTeamWorkspace(body, principal);

      return { body: { workspace }, status: 201 };
    })
  );

  app.get("/api/workspaces/:workspaceId", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const workspace = await getWorkspaceService().getWorkspace(c.req.param("workspaceId"), principal);

      return { body: { workspace } };
    })
  );

  app.get("/api/workspaces/:workspaceId/members", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const members = await getWorkspaceService().listMembers(c.req.param("workspaceId"), principal);

      return { body: { members } };
    })
  );

  app.patch("/api/workspaces/:workspaceId/members/:userId", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = changeMemberRoleInputSchema.parse(await c.req.json());
      const member = await getMembershipService().changeMemberRole(
        c.req.param("workspaceId"),
        c.req.param("userId"),
        body.role,
        principal
      );

      return { body: { member } };
    })
  );

  app.delete("/api/workspaces/:workspaceId/members/:userId", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      await getMembershipService().removeMember(
        c.req.param("workspaceId"),
        c.req.param("userId"),
        principal
      );

      return { body: { removed: true } };
    })
  );
}
