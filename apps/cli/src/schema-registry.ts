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
      header: "Authorization: Bearer <token>"
    },
    baseUrl: {
      env: ["AGENT_ARTIFACTS_BASE_URL"],
      flag: "--base-url",
      default: "http://127.0.0.1:3001"
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
    commands: listCliCommandSpecs()
  };
}
