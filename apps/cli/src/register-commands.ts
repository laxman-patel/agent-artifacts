import { Command } from "commander";
import type { CommandSpec } from "./command-spec.js";
import { ApiClient } from "./client.js";
import { readTokenFromStdin, resolveConfig, type OutputFormat } from "./config.js";
import { buildDryRunPreview } from "./dry-run.js";
import { parseJsonInput } from "./json-input.js";
import { emitNdjsonRecords, emitSuccess } from "./output.js";

interface GlobalOpts {
  baseUrl?: string;
  webUrl?: string;
  token?: string;
  tokenStdin?: boolean;
  format?: OutputFormat;
  quiet?: boolean;
  noInput?: boolean;
  debug?: boolean;
  verbose?: boolean;
  dryRun?: boolean;
  ndjson?: boolean;
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

const LIST_RECORD_KEYS = ["artifacts", "projects", "events", "shareLinks", "versions"] as const;

export function registerSpec(program: Command, spec: CommandSpec): void {
  const cmd = registerCommandPath(program, spec.name);
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
    const globals = getGlobalOpts(cmdObj);
    const token = globals.tokenStdin ? await readTokenFromStdin() : globals.token;
    const config = resolveConfig({ ...globals, token });
    const client = new ApiClient(config);
    const body = spec.bodySchema
      ? spec.bodySchema.parse(
          parseJsonInput(opts.json as string | undefined, opts.jsonFile as string | undefined, {
            example: spec.example
          })
        )
      : undefined;
    if (config.dryRun && spec.mutates) {
      emitSuccess(buildDryRunPreview(spec, body, opts), config.format);
      return;
    }

    const result = await spec.run({ config, client, options: opts, body });
    if (result.emitRawText) {
      const text = String(result.data);
      process.stdout.write(text.endsWith("\n") ? text : `${text}\n`);
      return;
    }

    const listRecords = config.ndjson ? extractListRecords(result.data) : undefined;
    if (listRecords) {
      emitNdjsonRecords(listRecords.map((record) => ({ ok: true, data: record })));
      return;
    }

    emitSuccess(result.data, config.format, result.nextActions);
  });
}

function extractListRecords(data: unknown): unknown[] | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  for (const key of LIST_RECORD_KEYS) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }
  return undefined;
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
    tokenStdin: opts.tokenStdin,
    format: opts.format,
    quiet: opts.quiet,
    noInput: opts.input === false ? true : opts.noInput,
    debug: opts.debug === true || opts.verbose === true,
    verbose: opts.verbose,
    dryRun: opts.dryRun,
    ndjson: opts.ndjson
  };
}
