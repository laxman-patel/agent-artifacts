import { z } from "zod";
import type { HttpMethod } from "./command-spec.js";
import { allCommands } from "./commands/index.js";
import { DEFAULT_BASE_URL, DEFAULT_WEB_URL } from "./build-defaults.js";
import { readCliVersion } from "./version.js";

export type { HttpMethod };

export interface CliCommandSpec {
  command: string;
  description: string;
  http?: { method: HttpMethod; path: string };
  bodySchema?: Record<string, unknown>;
  mutates: boolean;
  example?: string;
  flags?: { flag: string; required?: boolean; description: string }[];
}

export function listCliCommandSpecs(): CliCommandSpec[] {
  return allCommands.map((spec) => ({
    command: spec.name,
    description: spec.description,
    ...(spec.http ? { http: { method: spec.http.method, path: spec.http.pathTemplate } } : {}),
    ...(spec.bodySchema ? { bodySchema: z.toJSONSchema(spec.bodySchema) as Record<string, unknown> } : {}),
    mutates: spec.mutates,
    ...(spec.example ? { example: spec.example } : {}),
    ...(spec.options?.length
      ? {
          flags: spec.options.map((o) => ({
            flag: o.flag,
            description: o.description,
            ...(o.required ? { required: true } : {})
          }))
        }
      : {})
  }));
}

export function buildAgentSchema() {
  return {
    name: "artifacts",
    version: readCliVersion(),
    description: "CLI for agent-artifacts — thin wrapper over the REST API.",
    auth: {
      env: ["AGENT_ARTIFACTS_TOKEN"],
      flags: ["--token", "--token-stdin"],
      header: "Authorization: Bearer <token>",
      nonInteractive: "Set AGENT_ARTIFACTS_TOKEN, use --token-stdin, or pass --token; browser login requires a TTY"
    },
    baseUrl: {
      env: ["AGENT_ARTIFACTS_BASE_URL"],
      flag: "--base-url",
      default: DEFAULT_BASE_URL
    },
    webUrl: {
      env: ["AGENT_ARTIFACTS_WEB_URL"],
      flag: "--web-url",
      default: DEFAULT_WEB_URL,
      purpose: "Web app URL used during browser login"
    },
    globalFlags: {
      noInput: { flag: "--no-input", env: ["AGENT_ARTIFACTS_NO_INPUT"], description: "Fail instead of prompting or waiting" },
      dryRun: { flag: "-n, --dry-run", description: "Preview mutating commands without calling the API" },
      debug: { flag: "--debug", env: ["AGENT_ARTIFACTS_DEBUG"], description: "Print stack traces on failure" },
      verbose: { flag: "-v, --verbose", description: "Alias for --debug" },
      format: { flag: "--format json|text", env: ["AGENT_ARTIFACTS_FORMAT"] },
      ndjson: { flag: "--ndjson", description: "Stream list results as one JSON object per line" },
      quiet: { flag: "-q, --quiet", description: "Suppress stderr progress messages" }
    },
    input: {
      positionalArgs: false,
      jsonBody: { flags: ["--json", "--json-file"], stdin: "Use --json-file - to pipe JSON from stdin" },
      resourceIds: {
        artifactId: { flag: "--artifact-id", required: true },
        shareLinkId: { flag: "--share-link-id", required: true }
      },
      path: {
        owner: { flag: "--owner", required: true },
        projectSlug: { flag: "--project-slug", required: true },
        slug: { flag: "--slug", required: true }
      }
    },
    list: {
      defaultLimit: 50,
      maxLimit: 100,
      flags: ["--limit <n>", "--all", "--ndjson"],
      truncationHint: "stderr when results are truncated"
    },
    idempotency: {
      ensure: {
        flag: "--ensure",
        commands: ["artifact create", "project create"],
        behavior: "On conflict, return existing resource with created: false"
      },
      delete: "artifact delete succeeds with alreadyDeleted: true when the artifact is gone"
    },
    output: {
      default: "json when stdout is not a TTY, text when interactive",
      flag: "--format json|text",
      ndjson: "--ndjson streams one list record per line on stdout",
      streams: "Successful data on stdout; errors on stderr in both text and JSON modes",
      envelope: {
        success: { ok: true, data: "...", next_actions: "optional follow-up commands" },
        failure: { ok: false, error: { kind: "...", message: "..." } }
      },
      exitCodes: {
        "0": "success",
        "2": "invalid_request",
        "3": "not_found",
        "4": "forbidden or auth",
        "5": "conflict",
        "69": "network"
      }
    },
    discovery: "Run `artifacts schema` — do not parse --help.",
    help: "Every subcommand --help ends with copy-pasteable Examples; all inputs are flags (no positional arguments).",
    commands: listCliCommandSpecs()
  };
}
