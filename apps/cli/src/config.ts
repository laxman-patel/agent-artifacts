import { DEFAULT_BASE_URL, DEFAULT_WEB_URL } from "./build-defaults.js";
import { loadStoredCredentials } from "./auth/credentials.js";

export type OutputFormat = "json" | "text";

export interface CliConfig {
  baseUrl: string;
  webUrl: string;
  token?: string;
  format: OutputFormat;
  quiet: boolean;
}

export function resolveConfig(options: {
  baseUrl?: string;
  webUrl?: string;
  token?: string;
  format?: OutputFormat;
  quiet?: boolean;
}): CliConfig {
  const stored = loadStoredCredentials();
  const baseUrl = (
    options.baseUrl ??
    process.env.AGENT_ARTIFACTS_BASE_URL ??
    stored?.baseUrl ??
    DEFAULT_BASE_URL
  ).replace(/\/+$/, "");
  const webUrl = (
    options.webUrl ??
    process.env.AGENT_ARTIFACTS_WEB_URL ??
    stored?.webUrl ??
    DEFAULT_WEB_URL
  ).replace(/\/+$/, "");
  const token = options.token ?? process.env.AGENT_ARTIFACTS_TOKEN ?? stored?.token;
  const format = options.format ?? (process.stdout.isTTY ? "text" : "json");

  return {
    baseUrl,
    webUrl,
    token,
    format,
    quiet: options.quiet ?? false
  };
}
