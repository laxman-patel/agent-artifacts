#!/usr/bin/env bun
import { extractFormatFlag, resolveConfig } from "./config.js";
import { CliError } from "./errors.js";
import { emitFailure } from "./output.js";
import { runCli } from "./program.js";

runCli(process.argv).catch((error: unknown) => {
  const argv = process.argv;
  const config = resolveConfig({
    format: extractFormatFlag(argv),
    noInput: argv.includes("--no-input"),
    debug: argv.includes("--debug")
  });
  if (error instanceof CliError) {
    emitFailure(error, config.format);
  }
  console.error(error instanceof Error ? error.message : String(error));
  if (config.debug && error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
