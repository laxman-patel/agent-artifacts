import { readFileSync } from "node:fs";
import { CliError } from "./errors.js";

export function parseJsonInput(jsonFlag?: string, jsonFile?: string): unknown {
  if (jsonFlag && jsonFile) {
    throw new CliError("invalid_request", "Use only one of --json or --json-file.", 2);
  }

  if (jsonFile) {
    try {
      return JSON.parse(readFileSync(jsonFile, "utf8")) as unknown;
    } catch (error) {
      throw new CliError("invalid_request", `Failed to read --json-file: ${error instanceof Error ? error.message : String(error)}`, 2);
    }
  }

  if (jsonFlag) {
    try {
      return JSON.parse(jsonFlag) as unknown;
    } catch (error) {
      throw new CliError("invalid_request", `Invalid --json payload: ${error instanceof Error ? error.message : String(error)}`, 2);
    }
  }

  throw new CliError("invalid_request", "Mutation commands require --json or --json-file.", 2);
}
