import { DEFAULT_BASE_URL, DEFAULT_WEB_URL } from "./build-defaults.js";
import { loadStoredCredentials } from "./auth/credentials.js";

export type OutputFormat = "json" | "text";

export interface CliConfig {
  baseUrl: string;
  webUrl: string;
  token?: string;
  format: OutputFormat;
  quiet: boolean;
  noInput: boolean;
  debug: boolean;
  dryRun: boolean;
}

function envFlag(name: string): boolean {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
}

export function extractFormatFlag(argv: string[]): OutputFormat | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--format") {
      const next = argv[i + 1];
      if (next === "json" || next === "text") return next;
    }
    if (arg?.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (value === "json" || value === "text") return value;
    }
  }
  return undefined;
}

export function resolveConfig(options: {
  baseUrl?: string;
  webUrl?: string;
  token?: string;
  format?: OutputFormat;
  quiet?: boolean;
  noInput?: boolean;
  debug?: boolean;
  dryRun?: boolean;
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
  const envFormat = process.env.AGENT_ARTIFACTS_FORMAT;
  const formatFromEnv = envFormat === "json" || envFormat === "text" ? envFormat : undefined;
  const format = options.format ?? formatFromEnv ?? (process.stdout.isTTY ? "text" : "json");

  return {
    baseUrl,
    webUrl,
    token,
    format,
    quiet: options.quiet ?? false,
    noInput: options.noInput ?? envFlag("AGENT_ARTIFACTS_NO_INPUT"),
    debug: options.debug ?? envFlag("AGENT_ARTIFACTS_DEBUG"),
    dryRun: options.dryRun ?? false
  };
}
