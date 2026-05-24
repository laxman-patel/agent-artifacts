import { CliError } from "./errors.js";

export interface FlagSpec {
  optionKey: string;
  label: string;
  flag: string;
  example: string;
}

export function requireFlag(options: Record<string, unknown>, spec: FlagSpec): string {
  const value = options[spec.optionKey] as string | undefined;
  if (!value) {
    throw new CliError(
      "invalid_request",
      `Missing required flag ${spec.flag} <${spec.label}>.\n  Example: ${spec.example}`,
      2
    );
  }
  return value;
}
