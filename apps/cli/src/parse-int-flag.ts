import { CliError } from "./errors.js";

export function parseIntFlag(flag: string, example: string) {
  return (raw: string) => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || String(n) !== raw.trim()) {
      throw new CliError(
        "invalid_request",
        `Invalid integer for ${flag}: ${JSON.stringify(raw)}.\n  Example: ${example}`,
        2
      );
    }
    return n;
  };
}
