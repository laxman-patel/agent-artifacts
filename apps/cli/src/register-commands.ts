import { Command } from "commander";
import { z } from "zod";
import type { CommandSpec } from "./command-spec.js";
import { ApiClient } from "./client.js";
import { resolveConfig, type OutputFormat } from "./config.js";
import { CliError } from "./errors.js";
import { emitFailure, emitSuccess } from "./output.js";
import { parseJsonInput } from "./json-input.js";
import { buildDryRunPreview } from "./dry-run.js";

interface GlobalOpts {
  baseUrl?: string;
  webUrl?: string;
  token?: string;
  format?: OutputFormat;
  quiet?: boolean;
  noInput?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}

const GROUP_DESCRIPTIONS: Record<string, string> = {
  profile: "User profile",
  project: "Projects",
  artifact: "Artifacts",
  "artifact access": "Artifact access settings",
  path: "Resolve resources by URL path",
  share: "Share links",
  audit: "Audit log"
};

export function registerSpec(program: Command, spec: CommandSpec): void {
  const cmd = registerCommandPath(program, spec.name);
  spec.positional?.forEach((p) => cmd.argument(p.required ? `<${p.name}>` : `[${p.name}]`));
  spec.options?.forEach((o) => {
    if (o.required) {
      cmd.requiredOption(o.flag, o.description, o.parse as never);
    } else {
      cmd.option(o.flag, o.description, o.parse as never);
    }
  });
  cmd.description(spec.description);
  if (spec.example) {
    cmd.addHelpText("after", `\nExamples:\n  ${spec.example}\n`);
  }
  cmd.action(async (...args: unknown[]) => {
    const opts = args.at(-2) as Record<string, unknown>;
    const cmdObj = args.at(-1) as Command;
    const positionals = args.slice(0, -2) as string[];
    const config = resolveConfig(getGlobalOpts(cmdObj));
    const client = new ApiClient(config);
    const body = spec.bodySchema
      ? spec.bodySchema.parse(
          parseJsonInput(opts.json as string | undefined, opts.jsonFile as string | undefined, {
            example: spec.example
          })
        )
      : undefined;
    try {
      if (config.dryRun && spec.mutates) {
        emitSuccess(buildDryRunPreview(spec, positionals, body), config.format);
        return;
      }

      const result = await spec.run({ config, client, positionals, options: opts, body });
      if (result.emitRawText) {
        const text = String(result.data);
        process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
      } else {
        emitSuccess(result.data, config.format, result.nextActions);
      }
    } catch (error) {
      if (error instanceof CliError) {
        emitFailure(error, config.format);
      }
      if (error instanceof z.ZodError) {
        emitFailure(new CliError("invalid_request", error.message, 2, error.issues), config.format);
      }
      if (config.debug && error instanceof Error && error.stack) {
        process.stderr.write(`${error.stack}\n`);
      }
      throw error;
    }
  });
}

function registerCommandPath(root: Command, path: string): Command {
  const segments = path.split(" ");
  let current = root;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const pathSoFar = segments.slice(0, i + 1).join(" ");
    let next = current.commands.find((c) => c.name() === segment);
    if (!next) {
      next = current.command(segment);
      const groupDescription = GROUP_DESCRIPTIONS[pathSoFar];
      if (groupDescription) {
        next.description(groupDescription);
      }
    }
    current = next;
  }
  return current;
}

function getGlobalOpts(cmd: Command): GlobalOpts {
  const opts = cmd.optsWithGlobals() as GlobalOpts & Record<string, unknown>;
  return {
    baseUrl: opts.baseUrl,
    webUrl: opts.webUrl,
    token: opts.token,
    format: opts.format,
    quiet: opts.quiet,
    noInput: opts.noInput,
    debug: opts.debug,
    dryRun: opts.dryRun
  };
}
