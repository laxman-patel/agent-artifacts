#!/usr/bin/env node
import { preParseGlobals, resolveConfig } from "./config.js";
import { CliError } from "./errors.js";
import { emitFailure } from "./output.js";
import { runCli } from "./program.js";
import { z } from "zod";

runCli(process.argv).catch((error: unknown) => {
  const config = resolveConfig(preParseGlobals(process.argv));
  if (error instanceof CliError) {
    emitFailure(error, config.format);
  }
  if (error instanceof z.ZodError) {
    emitFailure(new CliError("invalid_request", error.message, 2, error.issues), config.format);
  }
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  if (config.debug && error instanceof Error && error.stack) {
    process.stderr.write(`${error.stack}\n`);
  }
  process.exit(1);
});
