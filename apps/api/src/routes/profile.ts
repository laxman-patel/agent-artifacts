import type { Hono } from "hono";
import { z } from "zod";
import { usernameSchema } from "@agent-artifacts/shared";
import { getArtifactService, getProfileService, getProjectService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal, resolvePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerProfileRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/profile/me", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      if (principal.type !== "user") {
        return c.json({ error: "forbidden", message: "User session required." }, 403);
      }

      const profile = await getProfileService().getProfile(principal.id);
      return profile;
    })
  );

  app.post("/api/profile/username", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      if (principal.type !== "user") {
        return c.json({ error: "forbidden", message: "User session required." }, 403);
      }

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
      const projectArtifacts = await getArtifactService().listArtifactsInProject(username, projectSlug, principal);
      const project = await getProjectService().getProjectByPathForListing(
        username,
        projectSlug,
        principal,
        projectArtifacts.length
      );

      return { project, artifacts: projectArtifacts };
    })
  );

  app.get("/api/by-path/:username/:projectSlug/:slug", (c) =>
    handle(c, async () => {
      const principal = await resolvePrincipal(c);
      const artifact = await getArtifactService().getArtifactByPath(
        c.req.param("username"),
        c.req.param("projectSlug"),
        c.req.param("slug"),
        principal
      );

      return artifact;
    })
  );
}
