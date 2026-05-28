import type { Hono } from "hono";
import { loadServerEnv } from "@agent-artifacts/config";
import { buildProjectArtifactUrl } from "@agent-artifacts/shared";
import { getAuth } from "../deps.js";
import { handleMcp } from "../http/handler.js";
import { handleMcpRequest } from "../http/mcp.js";
import { registerArtifactRoutes } from "./artifacts.js";
import { registerCliRoutes } from "./cli.js";
import { registerProfileRoutes } from "./profile.js";
import { registerProjectRoutes } from "./projects.js";
import { registerShareLinkRoutes } from "./share-links.js";
import { registerWorkspaceInvitationRoutes } from "./workspace-invitations.js";
import { registerWorkspaceRoutes } from "./workspaces.js";
import type { AppVariables } from "../deps.js";

export function registerRoutes(app: Hono<{ Variables: AppVariables }>) {
  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "agent-artifacts-api"
    })
  );

  app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));

  registerCliRoutes(app);

  app.post("/mcp", (c) => handleMcp(c, () => handleMcpRequest(c)));

  app.get("/.well-known/oauth-protected-resource", (c) =>
    c.json({
      resource: loadServerEnv().PUBLIC_APP_URL,
      authorization_servers: [loadServerEnv().BETTER_AUTH_URL],
      scopes_supported: ["openid", "profile", "email"],
      bearer_methods_supported: ["header"]
    })
  );

  registerProjectRoutes(app);
  registerWorkspaceRoutes(app);
  registerWorkspaceInvitationRoutes(app);
  registerProfileRoutes(app);
  registerArtifactRoutes(app);
  registerShareLinkRoutes(app);

  app.get("/api/slug-preview/:username/:projectSlug/:slug", (c) => {
    const username = c.req.param("username");
    const projectSlug = c.req.param("projectSlug");
    const slug = c.req.param("slug");
    const appUrl = loadServerEnv().PUBLIC_APP_URL;

    return c.json({
      url: buildProjectArtifactUrl(appUrl, username, projectSlug, slug)
    });
  });
}
