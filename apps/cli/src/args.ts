import { CliError } from "./errors.js";

export function requirePositional(
  positionals: string[],
  index: number,
  name: string,
  example?: string
): string {
  const value = positionals[index];
  if (value === undefined) {
    const hint = example ? `\n  Example: ${example}` : "";
    throw new CliError("invalid_request", `Missing required argument <${name}>.${hint}`, 2);
  }
  return value;
}
