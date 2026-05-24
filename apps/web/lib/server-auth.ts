import { createAuth, type BetterAuthHandle } from "@agent-artifacts/auth";
import { loadServerEnv } from "@agent-artifacts/config";
import { createDb, type Database } from "@agent-artifacts/db";

// Intentionally parallel to apps/api/src/deps.ts: each process (Next, API) owns one
// DB pool and one better-auth instance; no shared runtime package between them.
let authInstance: BetterAuthHandle | undefined;
let dbInstance: Database | undefined;

function getDb() {
  dbInstance ??= createDb({
    connectionString: loadServerEnv().DATABASE_URL
  });

  return dbInstance;
}

function getAuth() {
  authInstance ??= (() => {
    const env = loadServerEnv();
    const db = getDb();

    return createAuth({
      database: db,
      secret: env.BETTER_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
      webOrigin: env.PUBLIC_APP_URL,
      trustedOrigins: [env.BETTER_AUTH_URL, env.PUBLIC_APP_URL],
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET
    });
  })();

  return authInstance;
}

export async function hasAuthenticatedSession(cookieHeader: string | null): Promise<boolean> {
  if (!cookieHeader) {
    return false;
  }

  const session = await getAuth().api.getSession({
    headers: new Headers({ cookie: cookieHeader })
  });

  return Boolean(session?.session);
}
