export type OutputFormat = "json" | "text";

export interface CliConfig {
  baseUrl: string;
  token?: string;
  format: OutputFormat;
  quiet: boolean;
}

const DEFAULT_BASE_URL = "http://127.0.0.1:3001";

export function resolveConfig(options: {
  baseUrl?: string;
  token?: string;
  format?: OutputFormat;
  quiet?: boolean;
}): CliConfig {
  const baseUrl = (options.baseUrl ?? process.env.AGENT_ARTIFACTS_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const token = options.token ?? process.env.AGENT_ARTIFACTS_TOKEN;
  const format = options.format ?? (process.stdout.isTTY ? "text" : "json");

  return {
    baseUrl,
    token,
    format,
    quiet: options.quiet ?? false
  };
}
