import type { ApiClient } from "./client.js";
import type { CliConfig } from "./config.js";
import type { NextAction } from "./output.js";
import type { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface CommandSpec {
  name: string;
  description: string;
  options?: {
    flag: string;
    description: string;
    required?: boolean;
    parse?: (value: string) => unknown;
  }[];
  bodySchema?: z.ZodTypeAny;
  http?: { method: HttpMethod; pathTemplate: string };
  mutates: boolean;
  example?: string;
  run: (ctx: RunContext) => Promise<RunResult>;
}

export interface RunContext {
  config: CliConfig;
  client: ApiClient;
  options: Record<string, unknown>;
  body?: unknown;
}

export interface RunResult {
  data: unknown;
  nextActions?: NextAction[];
  emitRawText?: boolean;
}
