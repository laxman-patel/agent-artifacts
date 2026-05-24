import type { Hono } from "hono";
import { createProjectInputSchema } from "@agent-artifacts/artifact";
import { getProjectService } from "../deps.js";
import { handle } from "../http/handler.js";
import { requirePrincipal } from "../http/principal.js";
import type { AppVariables } from "../deps.js";

export function registerProjectRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/api/projects/slug-availability/:username/:slug", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const result = await getProjectService().checkProjectSlugAvailability(
        c.req.param("username"),
        c.req.param("slug"),
        principal
      );

      return {
        available: result.available,
        normalizedSlug: result.normalizedSlug,
        ownerUserId: result.ownerUserId
      };
    })
  );

  app.post("/api/projects", (c) =>
    handle(c, async () => {
      const principal = await requirePrincipal(c);
      const body = createProjectInputSchema.parse(await c.req.json());
      const project = await getProjectService().createProject(body, principal);

      return { body: project, status: 201 };
    })
  );
}
