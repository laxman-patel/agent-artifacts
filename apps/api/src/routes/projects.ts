import type { Hono } from "hono";
import { createProjectInputSchema } from "@agent-artifacts/artifact";
import { getProjectService } from "../deps.js";
import { artifactErrorResponse } from "../http/errors.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerProjectRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/projects/slug-availability/:username/:slug", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const result = await getProjectService().checkProjectSlugAvailability(
        c.req.param("username"),
        c.req.param("slug"),
        principal
      );

      return c.json({
        available: result.available,
        normalizedSlug: result.normalizedSlug,
        ownerUserId: result.ownerUserId
      });
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });

  app.post("/api/projects", async (c) => {
    try {
      const principal = await requirePrincipal(c);
      const body = createProjectInputSchema.parse(await c.req.json());
      const project = await getProjectService().createProject(body, principal);

      return c.json(project, 201);
    } catch (error) {
      return artifactErrorResponse(c, error);
    }
  });
}
