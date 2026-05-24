import type { OutputFormat } from "./config.js";
import { CliError, exitCodeForKind } from "./errors.js";

export interface CliResult<T = unknown> {
  ok: true;
  data: T;
  next_actions?: NextAction[];
}

export interface CliFailure {
  ok: false;
  error: {
    kind: string;
    message: string;
    details?: unknown;
  };
}

export interface NextAction {
  command: string;
  description: string;
}

export function shouldUseColor(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== "") {
    return false;
  }
  return Boolean(process.stdout.isTTY);
}

export function emitNdjsonRecords(records: unknown[]): void {
  for (const record of records) {
    process.stdout.write(`${JSON.stringify(record)}\n`);
  }
}

export function emitSuccess<T>(data: T, format: OutputFormat, nextActions?: NextAction[]): void {
  if (format === "json") {
    const payload: CliResult<T> = { ok: true, data };
    if (nextActions?.length) {
      payload.next_actions = nextActions;
    }
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  if (typeof data === "string") {
    process.stdout.write(data.endsWith("\n") ? data : `${data}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function emitFailure(error: CliError, format: OutputFormat): never {
  const payload: CliFailure = {
    ok: false,
    error: {
      kind: error.kind,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {})
    }
  };

  if (format === "json") {
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    process.stderr.write(`${error.kind}: ${error.message}\n`);
    if (error.details !== undefined) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
  }

  process.exit(exitCodeForKind(error.kind));
}

export function logInfo(message: string, quiet: boolean): void {
  if (!quiet) {
    process.stderr.write(`${message}\n`);
  }
}
