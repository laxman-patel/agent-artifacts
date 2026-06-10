import type { Hono } from "hono";
import { z } from "zod";
import { actsForOwner } from "@agent-artifacts/access";
import { ProjectNotFoundError } from "@agent-artifacts/artifact";
import { usernameSchema } from "@agent-artifacts/shared";
import { getArtifactService, getProfileService, getProjectService } from "../deps.js";
import { handle } from "../http/handler.js";
import {
  applyShareGrantForArtifact,
  requireHumanPrincipal,
  requirePrincipal,
  resolvePrincipal
} from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerProfileRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/profile/me", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);

      const profile = await getProfileService().getProfile(principal.id);
      return profile;
    })
  );

  app.get("/api/profile/username-availability/:username", (c) =>
    handle(c, async () => getProfileService().checkUsernameAvailability(c.req.param("username")))
  );

  app.post("/api/profile/username", (c) =>
    handle(c, async () => {
      const principal = await requireHumanPrincipal(c);

      const body = z.object({ username: usernameSchema }).parse(await c.req.json());
      const result = await getProfileService().claimUsername(principal.id, body.username);

      return { body: result, status: 201 };
    })
  );

  app.get("/api/profile/projects", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const projectList = await getProjectService().listOwnedProjects(principal);

      return { projects: projectList };
    })
  );

  app.get("/api/profile/artifacts", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const artifacts = await getArtifactService().listOwnedArtifacts(principal);

      return { artifacts };
    })
  );

  app.get("/api/by-path/:username/:projectSlug", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const username = c.req.param("username");
      const projectSlug = c.req.param("projectSlug");
      const project = await getProjectService().getProjectByPathRaw(username, projectSlug);
      const projectArtifacts = await getArtifactService().listArtifactsInProject(username, projectSlug, principal);
      const isOwner = actsForOwner(principal, project.ownerUserId);
      if (!isOwner && projectArtifacts.length === 0) {
        throw new ProjectNotFoundError();
      }

      return { project, artifacts: projectArtifacts };
    })
  );

  app.get("/api/by-path/:username/:projectSlug/:slug", (c) =>
    handle(c, async () => {
      const basePrincipal = await resolvePrincipal(c);
      const artifactByPath = await getArtifactService().resolveActiveArtifactByPath(
        c.req.param("username"),
        c.req.param("projectSlug"),
        c.req.param("slug")
      );
      const principal = await applyShareGrantForArtifact(c.req.header("cookie"), artifactByPath.id, basePrincipal);
      const artifact = await getArtifactService().getArtifact(artifactByPath.id, principal);

      return artifact;
    })
  );
}
