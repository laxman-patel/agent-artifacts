declare global {
  // Injected at production compile time via `bun build --define`.
  var __CLI_DEFAULT_BASE_URL__: string | undefined;
  var __CLI_DEFAULT_WEB_URL__: string | undefined;
}

/** Dev default: local API. Overridden in production builds. */
export const DEFAULT_BASE_URL =
  globalThis.__CLI_DEFAULT_BASE_URL__ ?? "http://127.0.0.1:3001";

/** Dev default: local web app. Overridden in production builds. */
export const DEFAULT_WEB_URL =
  globalThis.__CLI_DEFAULT_WEB_URL__ ?? "http://localhost:3000";
