#!/usr/bin/env bun
import { extractFormatFlag, resolveConfig } from "./config.js";
import { CliError } from "./errors.js";
import { emitFailure } from "./output.js";
import { runCli } from "./program.js";

runCli(process.argv).catch((error: unknown) => {
  const config = resolveConfig({ format: extractFormatFlag(process.argv) });
  if (error instanceof CliError) {
    emitFailure(error, config.format);
  }
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
