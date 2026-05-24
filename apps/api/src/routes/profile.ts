import type { Hono } from "hono";
import { z } from "zod";
import { usernameSchema } from "@agent-artifacts/shared";
import { getArtifactService, getProfileService, getProjectService } from "../deps.js";
import { artifactErrorResponse } from "../http/errors.js";
import { requirePrincipal, resolvePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerProfileRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/profile/me", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      if (principal.type !== "user") {
        return c.json({ error: "forbidden", message: "User session required." }, 403);
      }

      const profile = await getProfileService().getProfile(principal.id);
      return c.json(profile);
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.post("/api/profile/username", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      if (principal.type !== "user") {
        return c.json({ error: "forbidden", message: "User session required." }, 403);
      }

      const body = z.object({ username: usernameSchema }).parse(await c.req.json());
      const result = await getProfileService().claimUsername(principal.id, body.username);

      return c.json(result, 201);
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.get("/api/profile/projects", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const projectList = await getProjectService().listOwnedProjects(principal);

      return c.json({ projects: projectList });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.get("/api/profile/artifacts", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const artifacts = await getArtifactService().listOwnedArtifacts(principal);

      return c.json({ artifacts });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.get("/api/by-path/:username/:projectSlug", async (c) => {
    try {
      const principal = await resolvePrincipal(c);
      const username = c.req.param("username");
      const projectSlug = c.req.param("projectSlug");
      const projectArtifacts = await getArtifactService().listArtifactsInProject(username, projectSlug, principal);
      const project = await getProjectService().getProjectByPathForListing(
        username,
        projectSlug,
        principal,
        projectArtifacts.length
      );

      return c.json({ project, artifacts: projectArtifacts });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.get("/api/by-path/:username/:projectSlug/:slug", async (c) => {
    try {
      const principal = await resolvePrincipal(c);
      const artifact = await getArtifactService().getArtifactByPath(
        c.req.param("username"),
        c.req.param("projectSlug"),
        c.req.param("slug"),
        principal
      );

      return c.json(artifact);
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });
}
