import type { Hono } from "hono";
import { z } from "zod";
import {
  createWorkspaceArtifactInputSchema,
  createWorkspaceProjectInputSchema,
  ProjectNotFoundError
} from "@agent-artifacts/artifact";
import { createTeamWorkspaceInputSchema, changeMemberRoleInputSchema } from "@agent-artifacts/workspace";
import {
  getArtifactService,
  getAuditService,
  getMembershipService,
  getProjectService,
  getWorkspaceAccess,
  getWorkspaceService
} from "../deps.js";
import { handle } from "../http/handler.js";
import { requireHumanPrincipal, requirePrincipal, resolvePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

const auditEventsLimitSchema = z.coerce.number().int().positive().max(100).default(50);

export function registerWorkspaceRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/workspaces", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const workspaces = await getWorkspaceService().listWorkspacesForUser(principal);

      return { workspaces };
    })
  );

  app.get("/api/workspaces/slug-availability/:slug", (c) =>
    handle(c, async () => {
      await requirePrincipal(c);
      const result = await getWorkspaceService().checkSlugAvailability(c.req.param("slug"));

      return result;
    })
  );

  app.get("/api/workspaces/by-slug/:slug", (c) =>
    handle(c, async () => {
      const workspace = await getWorkspaceService().getPublicWorkspaceBySlug(c.req.param("slug"));

      return { workspace };
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

      return { workspace };
    })
  );

  app.get("/api/workspaces/:workspaceId/projects", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const workspaceId = c.req.param("workspaceId");
      const projects = await getProjectService().listWorkspaceProjects(workspaceId, principal);

      return { projects };
    })
  );

  app.get("/api/workspaces/:workspaceId/projects/slug-availability/:slug", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const result = await getProjectService().checkWorkspaceProjectSlugAvailability(
        c.req.param("workspaceId"),
        c.req.param("slug"),
        principal
      );

      return result;
    })
  );

  app.post("/api/workspaces/:workspaceId/projects", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const workspaceId = c.req.param("workspaceId");
      const workspace = await getWorkspaceService().getWorkspace(workspaceId, principal);
      const body = createWorkspaceProjectInputSchema.parse(await c.req.json());
      const project = await getProjectService().createWorkspaceProject(
        workspaceId,
        workspace.slug,
        body,
        principal
      );

      return { body: { project }, status: 201 };
    })
  );

  app.get("/api/workspaces/:workspaceId/artifacts", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const artifacts = await getArtifactService().listWorkspaceArtifacts(c.req.param("workspaceId"), principal);

      return { artifacts };
    })
  );

  app.post("/api/workspaces/:workspaceId/artifacts", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const workspaceId = c.req.param("workspaceId");
      const workspace = await getWorkspaceService().getWorkspace(workspaceId, principal);
      const body = createWorkspaceArtifactInputSchema.parse(await c.req.json());
      const artifact = await getArtifactService().createWorkspaceArtifact(
        workspaceId,
        workspace.slug,
        body,
        principal
      );

      return { body: { artifact }, status: 201 };
    })
  );

  app.get("/api/workspaces/:workspaceId/by-path/:projectSlug", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const workspaceId = c.req.param("workspaceId");
      const projectSlug = c.req.param("projectSlug");
      const project = await getProjectService().getWorkspaceProjectByPathRaw(workspaceId, projectSlug);
      const artifacts = await getArtifactService().listArtifactsInWorkspaceProject(
        workspaceId,
        projectSlug,
        principal
      );
      if (artifacts.length === 0) {
        const decision = await getWorkspaceAccess().authorize({
          principal,
          action: "workspace.view",
          context: { workspaceId }
        });
        if (!decision.allowed) {
          throw new ProjectNotFoundError();
        }
      }

      return { project, artifacts };
    })
  );

  app.get("/api/workspaces/:workspaceId/by-path/:projectSlug/:slug", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const artifact = await getArtifactService().getArtifactByWorkspacePath(
        c.req.param("workspaceId"),
        c.req.param("projectSlug"),
        c.req.param("slug"),
        principal
      );

      return artifact;
    })
  );

  app.get("/api/workspaces/:workspaceId/members", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const members = await getWorkspaceService().listMembers(c.req.param("workspaceId"), principal);

      return { members };
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

      return { member };
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

      return { removed: true };
    })
  );

  app.get("/api/workspaces/:workspaceId/audit-events", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);
      const workspaceId = c.req.param("workspaceId");
      const artifactId = c.req.query("artifactId");
      const limit = auditEventsLimitSchema.parse(c.req.query("limit"));

      await getWorkspaceAccess().assertAuthorized({
        principal,
        action: "workspace.manage_members",
        context: { workspaceId }
      });

      const events = await getAuditService().listAuditEvents({ workspaceId, artifactId, limit });

      return { events };
    })
  );
}
