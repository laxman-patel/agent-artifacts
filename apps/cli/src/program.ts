import { Command } from "commander";
import { allCommands } from "./commands/index.js";
import { buildAgentSchema } from "./schema-registry.js";
import { type OutputFormat } from "./config.js";
import { emitSuccess } from "./output.js";
import { registerSpec } from "./register-commands.js";
import { readCliVersion } from "./version.js";

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

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
  artifacts login
  artifacts whoami --format json
  artifacts push --owner alice --project-slug default --file ./report.md
  artifacts artifact list
  artifacts artifact create --json '{"ownerUsername":"alice","projectSlug":"default","slug":"readme","type":"md","title":"Readme","content":"# Hi"}'
`
  );

  program
    .command("schema")
    .description("Print machine-readable CLI capabilities for agents (JSON)")
    .addHelpText("after", "\nExamples:\n  artifacts schema\n  artifacts schema | jq '.commands[].command'\n")
    .action(() => {
      emitSuccess(buildAgentSchema(), "json");
    });

  for (const spec of allCommands) {
    registerSpec(program, spec);
  }

  await program.parseAsync(argv);
}
