import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadMonorepoEnv } from "../../../packages/config/src/load-monorepo-env.js";

export interface ProdBuildUrls {
  baseUrl: string;
  webUrl: string;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Resolve API + web URLs for a production CLI build from process env. */
export function resolveProdBuildUrls(env: NodeJS.ProcessEnv = process.env): ProdBuildUrls | null {
  const baseUrl = stripTrailingSlash(
    env.AGENT_ARTIFACTS_BASE_URL ?? env.INTERNAL_API_URL ?? ""
  );
  const webUrl = stripTrailingSlash(
    env.AGENT_ARTIFACTS_WEB_URL ??
      env.PUBLIC_APP_URL ??
      env.NEXT_PUBLIC_APP_URL ??
      env.BETTER_AUTH_URL ??
      ""
  );

  if (!baseUrl || !webUrl) {
    return null;
  }

  return { baseUrl, webUrl };
}

/** Load monorepo `.env` / `.env.local`, then resolve production build URLs. */
export function loadProdBuildUrls(startDir?: string): ProdBuildUrls | null {
  const dir =
    startDir ??
    join(dirname(fileURLToPath(import.meta.url)), "../../..");

  loadMonorepoEnv(dir);
  return resolveProdBuildUrls(process.env);
}
