import { z } from "zod";
import type { HttpMethod } from "./command-spec.js";
import { allCommands } from "./commands/index.js";

export type { HttpMethod };

export interface CliCommandSpec {
  command: string;
  description: string;
  http?: { method: HttpMethod; path: string };
  bodySchema?: Record<string, unknown>;
  mutates: boolean;
  example?: string;
}

export function listCliCommandSpecs(): CliCommandSpec[] {
  return allCommands.map((spec) => ({
    command: spec.name,
    description: spec.description,
    ...(spec.http ? { http: { method: spec.http.method, path: spec.http.pathTemplate } } : {}),
    ...(spec.bodySchema ? { bodySchema: z.toJSONSchema(spec.bodySchema) as Record<string, unknown> } : {}),
    mutates: spec.mutates,
    ...(spec.example ? { example: spec.example } : {})
  }));
}

export function buildAgentSchema() {
  return {
    name: "artifacts",
    version: "0.1.0",
    description: "CLI for agent-artifacts — thin wrapper over the REST API.",
    auth: {
      env: ["AGENT_ARTIFACTS_TOKEN"],
      flag: "--token",
      header: "Authorization: Bearer <token>",
      nonInteractive: "Set AGENT_ARTIFACTS_TOKEN or use --token; browser login requires a TTY unless --no-input is omitted"
    },
    baseUrl: {
      env: ["AGENT_ARTIFACTS_BASE_URL"],
      flag: "--base-url",
      default: "http://127.0.0.1:3001"
    },
    globalFlags: {
      noInput: { flag: "--no-input", env: ["AGENT_ARTIFACTS_NO_INPUT"], description: "Fail instead of prompting or waiting" },
      dryRun: { flag: "-n, --dry-run", description: "Preview mutating commands without calling the API" },
      debug: { flag: "--debug", env: ["AGENT_ARTIFACTS_DEBUG"], description: "Print stack traces on failure" },
      format: { flag: "--format json|text", env: ["AGENT_ARTIFACTS_FORMAT"] },
      quiet: { flag: "-q, --quiet", description: "Suppress stderr progress messages" }
    },
    input: {
      jsonBody: { flags: ["--json", "--json-file"], stdin: "Use --json-file - to pipe JSON from stdin" },
      resourceIds: {
        artifactId: { flag: "--artifact-id", positional: "[artifactId]" },
        shareLinkId: { flag: "--share-link-id", positional: "[shareLinkId]" }
      },
      path: {
        owner: "--owner",
        projectSlug: "--project-slug",
        slug: "--slug"
      }
    },
    list: {
      defaultLimit: 50,
      maxLimit: 100,
      flags: ["--limit <n>", "--all"],
      truncationHint: "stderr when results are truncated"
    },
    output: {
      default: "json when stdout is not a TTY, text when interactive",
      flag: "--format json|text",
      envelope: {
        success: { ok: true, data: "...", next_actions: "optional follow-up commands" },
        failure: { ok: false, error: { kind: "...", message: "..." } }
      },
      exitCodes: {
        "0": "success",
        "2": "invalid_request",
        "3": "not_found",
        "4": "forbidden or auth",
        "5": "conflict"
      }
    },
    discovery: "Run `artifacts schema` — do not parse --help.",
    help: "Every subcommand --help ends with copy-pasteable Examples; bare `artifacts` prints the command index.",
    commands: listCliCommandSpecs()
  };
}
