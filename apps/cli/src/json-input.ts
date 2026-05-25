import { readFileSync } from "node:fs";
import { CliError } from "./errors.js";

export interface JsonInputOptions {
  example?: string;
}

function optionsHint(options?: JsonInputOptions): string {
  if (options?.example) {
    return `\n  Example: ${options.example}`;
  }
  return "\n  Example: artifacts artifact create --json '{\"ownerUsername\":\"alice\",\"projectSlug\":\"default\",\"slug\":\"readme\",\"type\":\"md\",\"title\":\"Readme\",\"content\":\"# Hi\"}'";
}

function readJsonSource(jsonFlag?: string, jsonFile?: string, options?: JsonInputOptions): string {
  if (jsonFlag && jsonFile) {
    throw new CliError(
      "invalid_request",
      `Use only one of --json or --json-file.${optionsHint(options)}`,
      2
    );
  }

  if (jsonFile) {
    if (jsonFile === "-") {
      try {
        return readFileSync(0, "utf8");
      } catch (error) {
        throw new CliError(
          "invalid_request",
          `Failed to read JSON from stdin: ${error instanceof Error ? error.message : String(error)}`,
          2
        );
      }
    }

    try {
      return readFileSync(jsonFile, "utf8");
    } catch (error) {
      throw new CliError(
        "invalid_request",
        `Failed to read --json-file ${jsonFile}: ${error instanceof Error ? error.message : String(error)}`,
        2
      );
    }
  }

  if (jsonFlag) {
    return jsonFlag;
  }

  throw new CliError("invalid_request", `Mutation commands require --json or --json-file.${optionsHint(options)}`, 2);
}

export function parseJsonInput(
  jsonFlag?: string,
  jsonFile?: string,
  options?: JsonInputOptions
): unknown {
  const source = readJsonSource(jsonFlag, jsonFile, options);
  if (!source.trim()) {
    throw new CliError(
      "invalid_request",
      `JSON body is empty.${optionsHint(options)}`,
      2
    );
  }

  try {
    return JSON.parse(source) as unknown;
  } catch (error) {
    throw new CliError(
      "invalid_request",
      `Invalid JSON body: ${error instanceof Error ? error.message : String(error)}${optionsHint(options)}`,
      2
    );
  }
}
