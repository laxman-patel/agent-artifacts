import { Hono } from "hono";
import { createAuth } from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { createDb } from "@agent-artifacts/db";
import { buildArtifactUrl } from "@agent-artifacts/shared";

export const app = new Hono();

let authInstance: ReturnType<typeof createAuth> | undefined;

function getAuth() {
  authInstance ??= (() => {
    const env = loadServerEnv();
    const db = createDb({
      connectionString: env.DATABASE_URL
    });

    return createAuth({
      database: db,
      secret: env.BETTER_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET
    });
  })();

  return authInstance;
}

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "agent-artifacts-api"
  })
);

app.on(["GET", "POST"], "/api/auth/*", (c) => getAuth().handler(c.req.raw));

app.get("/api/slug-preview/:username/:slug", (c) => {
  const username = c.req.param("username");
  const slug = c.req.param("slug");
  const appUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:3000";

  return c.json({
    url: buildArtifactUrl(appUrl, username, slug)
  });
});
