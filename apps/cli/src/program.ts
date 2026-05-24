import { Command } from "commander";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { allCommands } from "./commands/index.js";
import { buildAgentSchema } from "./schema-registry.js";
import { resolveConfig, extractFormatFlag, type OutputFormat } from "./config.js";
import { CliError } from "./errors.js";
import { emitFailure, emitSuccess } from "./output.js";
import { registerSpec } from "./register-commands.js";

function readCliVersion(): string {
  try {
    const packageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name("artifacts")
    .description("Agent-friendly CLI for agent-artifacts REST API")
    .version(readCliVersion(), "-V, --version", "Print CLI version and exit")
    .option("--base-url <url>", "API base URL (env: AGENT_ARTIFACTS_BASE_URL)")
    .option("--web-url <url>", "Web app URL for browser login (env: AGENT_ARTIFACTS_WEB_URL)")
    .option("--token <token>", "Bearer token (env: AGENT_ARTIFACTS_TOKEN)")
    .option("--format <format>", "Output format: json or text (env: AGENT_ARTIFACTS_FORMAT)", (value) => value as OutputFormat)
    .option("-q, --quiet", "Suppress stderr progress messages")
    .option("--no-input", "Never prompt or wait for interactive input; fail fast (env: AGENT_ARTIFACTS_NO_INPUT=1)")
    .option("--debug", "Print stack traces on failure (env: AGENT_ARTIFACTS_DEBUG=1)")
    .option("-n, --dry-run", "Preview mutating commands without calling the API")
    .showHelpAfterError("(add --help for command list; use `artifacts schema` for machine-readable capabilities)");

  if (argv.length <= 2) {
    program.outputHelp();
    return;
  }

  program
    .command("schema")
    .description("Print machine-readable CLI capabilities for agents (JSON)")
    .action(() => {
      emitSuccess(buildAgentSchema(), "json");
    });

  for (const spec of allCommands) {
    registerSpec(program, spec);
  }

  try {
    await program.parseAsync(argv);
  } catch (error) {
    const config = resolveConfig({ format: extractFormatFlag(argv) });
    if (error instanceof CliError) {
      emitFailure(error, config.format);
    }
    if (error instanceof z.ZodError) {
      emitFailure(new CliError("invalid_request", error.message, 2, error.issues), config.format);
    }
    throw error;
  }
}
