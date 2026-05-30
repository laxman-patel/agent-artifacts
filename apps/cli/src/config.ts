import { DEFAULT_BASE_URL, DEFAULT_WEB_URL } from "./build-defaults.js";
import { readFileSync } from "node:fs";
import { loadStoredCredentials } from "./auth/credentials.js";

export type OutputFormat = "json" | "text";

export interface CliConfig {
  baseUrl: string;
  webUrl: string;
  token?: string;
  workspace?: string;
  format: OutputFormat;
  quiet: boolean;
  noInput: boolean;
  debug: boolean;
  dryRun: boolean;
  ndjson: boolean;
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

function envFlag(name: string): boolean {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function preParseGlobals(argv: string[]): {
  format?: OutputFormat;
  noInput?: boolean;
  debug?: boolean;
  ndjson?: boolean;
} {
  return {
    format: extractFormatFlag(argv),
    noInput: argv.includes("--no-input"),
    debug: argv.includes("--debug") || argv.includes("--verbose") || argv.includes("-v"),
    ndjson: argv.includes("--ndjson")
  };
}

export async function readTokenFromStdin(): Promise<string> {
  const token = readFileSync(0, "utf8").trim();
  if (!token) {
    throw new Error("Expected a bearer token on stdin for --token-stdin.");
  }
  return token;
}

export function resolveConfig(options: {
  baseUrl?: string;
  webUrl?: string;
  token?: string;
  workspace?: string;
  format?: OutputFormat;
  quiet?: boolean;
  noInput?: boolean;
  debug?: boolean;
  dryRun?: boolean;
  ndjson?: boolean;
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
  const workspace = normalizeOptionalString(options.workspace) ?? normalizeOptionalString(process.env.AGENT_ARTIFACTS_WORKSPACE);
  const envFormat = process.env.AGENT_ARTIFACTS_FORMAT;
  const formatFromEnv = envFormat === "json" || envFormat === "text" ? envFormat : undefined;
  const format = options.format ?? formatFromEnv ?? (process.stdout.isTTY ? "text" : "json");

  return {
    baseUrl,
    webUrl,
    token,
    workspace,
    format,
    quiet: options.quiet ?? false,
    noInput: options.noInput ?? envFlag("AGENT_ARTIFACTS_NO_INPUT"),
    debug: options.debug ?? envFlag("AGENT_ARTIFACTS_DEBUG"),
    dryRun: options.dryRun ?? false,
    ndjson: options.ndjson ?? false
  };
}
