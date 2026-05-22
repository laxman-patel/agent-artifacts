#!/usr/bin/env bun
import { runCli } from "./program.js";

runCli(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
