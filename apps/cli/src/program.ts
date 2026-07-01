import { Command, CommanderError } from "commander";
import { allCommands } from "./commands/index.js";
import { preParseGlobals, resolveConfig, type OutputFormat } from "./config.js";
import { CliError } from "./errors.js";
import { emitFailure, emitSuccess, type NextAction } from "./output.js";
import { registerSpec } from "./register-commands.js";
import { buildAgentSchema, buildCompactAgentSchema } from "./schema-registry.js";
import { readCliVersion } from "./version.js";

// Commander error codes that represent a clean, intentional exit (the user asked
// for help or the version). For these we let Commander's own text stand; every
// other CommanderError is a parse failure that we turn into the machine-readable
// error envelope so agents never get raw "error: unknown command" text.
const CLEAN_EXIT_CODES = new Set(["commander.help", "commander.helpDisplayed", "commander.version"]);

const SCHEMA_NEXT_ACTION: NextAction = {
  command: "artifacts schema",
  description: "List every available command and its flags (machine-readable)"
};

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  // Buffer Commander's own stderr so a parse error doesn't print raw text before
  // we emit the JSON envelope. Help/version output still flushes on clean exits.
  const errBuffer: string[] = [];
  program.configureOutput({ writeErr: (str) => errBuffer.push(str) });
  program.exitOverride();

  program
    .name("artifacts")
    .description("Agent-friendly CLI for agent-artifacts REST API")
    .version(readCliVersion(), "-V, --version", "Print CLI version and exit")
    .option("--base-url <url>", "API base URL (env: AGENT_ARTIFACTS_BASE_URL)")
    .option("--web-url <url>", "Web app URL for browser login (env: AGENT_ARTIFACTS_WEB_URL)")
    .option(
      "--token <token>",
      "Bearer token (env: AGENT_ARTIFACTS_TOKEN; discouraged on shared hosts — prefer env or --token-stdin)"
    )
    .option("--token-stdin", "Read bearer token from stdin (single trimmed line)")
    .option("--format <format>", "Output format: json or text (env: AGENT_ARTIFACTS_FORMAT)", (value) => value as OutputFormat)
    .option("--ndjson", "Stream list results as one JSON object per line (mutually exclusive with envelope JSON)")
    .option("-q, --quiet", "Suppress stderr progress messages")
    .option("--no-input", "Never prompt or wait for interactive input; fail fast (env: AGENT_ARTIFACTS_NO_INPUT=1)")
    .option("-v, --verbose", "Alias for --debug (extra stderr diagnostics)")
    .option("--debug", "Print stack traces on failure (env: AGENT_ARTIFACTS_DEBUG=1)")
    .option("-n, --dry-run", "Preview mutating commands without calling the API")
    .showHelpAfterError("(add --help for command list; use `artifacts schema` for machine-readable capabilities)");

  program.addHelpText(
    "afterAll",
    `
Discovery:
  artifacts schema     Machine-readable command catalog (preferred over --help)

Examples:
  artifacts push --project-slug default --file ./report.md
  artifacts doctor
  artifacts whoami --format json
  artifacts artifact list
`
  );

  program
    .command("schema")
    .description("Print machine-readable CLI capabilities for agents (JSON, single object)")
    .option("--compact", "Emit a slimmer catalog (drops full JSON body schemas; keeps required flags)")
    .addHelpText("after", "\nExamples:\n  artifacts schema\n  artifacts schema --compact\n  artifacts schema | jq '.commands[].command'\n")
    .action((options: { compact?: boolean }) => {
      emitSuccess(options.compact ? buildCompactAgentSchema() : buildAgentSchema(), "json");
    });

  for (const spec of allCommands) {
    registerSpec(program, spec);
  }

  try {
    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof CommanderError) {
      handleCommanderError(error, argv, errBuffer);
      return;
    }
    throw error;
  }
}

/**
 * Translates a Commander parse outcome into agent-friendly output:
 *   - help/version: flush whatever Commander produced and exit with its code.
 *   - anything else (unknown command/option, missing/invalid args): emit the
 *     standard failure envelope with an `invalid_request` kind, a stable exit
 *     code, and a next_action pointing at `artifacts schema`.
 */
function handleCommanderError(error: CommanderError, argv: string[], errBuffer: string[]): void {
  if (CLEAN_EXIT_CODES.has(error.code)) {
    const buffered = errBuffer.join("");
    if (buffered) {
      process.stderr.write(buffered);
    }
    process.exit(error.exitCode);
  }

  const format = resolveConfig(preParseGlobals(argv)).format;
  const base = cleanCommanderMessage(error.message);
  const separator = /[.?!]$/.test(base) ? "" : ".";
  const message = `${base}${separator} Run \`artifacts schema\` for the command catalog.`;
  emitFailure(new CliError("invalid_request", message, 2, { commanderCode: error.code }), format, [SCHEMA_NEXT_ACTION]);
}

function cleanCommanderMessage(message: string): string {
  return message
    .replace(/^error:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
