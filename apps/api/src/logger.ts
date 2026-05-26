import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Logtail } from "@logtail/node";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  service: string;
  env: string;
  version: string;
  requestId?: string;
  [key: string]: unknown;
}

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";
const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const packageVersion = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8")
).version as string;

const DEFAULT_CONTEXT = {
  service: "agent-artifacts-api",
  env: process.env.NODE_ENV ?? "development",
  version: packageVersion
} as const;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "secret",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "client_secret",
  "better_auth_secret",
  "google_client_secret",
  "s3_secret_access_key",
  "s3_access_key_id",
  "sharelinktoken"
]);

const IPv4_REGEX = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const IPv6_REGEX = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

let logtailClient: Logtail | undefined;
let bootWarningLogged = false;

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function isBetterStackEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "test" &&
    Boolean(process.env.BETTER_STACK_SOURCE_TOKEN && process.env.BETTER_STACK_INGESTING_URL)
  );
}

function getLogtailClient(): Logtail | undefined {
  if (process.env.NODE_ENV === "test") {
    return undefined;
  }

  if (!process.env.BETTER_STACK_SOURCE_TOKEN || !process.env.BETTER_STACK_INGESTING_URL) {
    if (process.env.NODE_ENV === "production" && !bootWarningLogged) {
      bootWarningLogged = true;
      emitStdout("warn", "better_stack_unconfigured", {
        message: "BETTER_STACK_SOURCE_TOKEN and BETTER_STACK_INGESTING_URL are unset; shipping logs to stdout only."
      });
    }
    return undefined;
  }

  logtailClient ??= new Logtail(process.env.BETTER_STACK_SOURCE_TOKEN, {
    endpoint: process.env.BETTER_STACK_INGESTING_URL
  });

  return logtailClient;
}

function hashIp(ip: string): string {
  const salt = process.env.LOG_IP_SALT ?? "dev-log-ip-salt";
  return createHash("sha256").update(salt + ip).digest("hex").slice(0, 16);
}

function looksLikeIp(value: string): boolean {
  return IPv4_REGEX.test(value) || IPv6_REGEX.test(value);
}

function sanitizeValue(key: string, value: unknown): unknown {
  if (typeof value === "string") {
    if (looksLikeIp(value)) {
      return hashIp(value);
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedKey === "useragent" || normalizedKey === "user_agent") {
      return value.length > 200 ? `${value.slice(0, 200)}…[truncated]` : value;
    }

    return value.length > 1000 ? `${value.slice(0, 1000)}…[truncated]` : value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(String(index), item));
  }

  if (value && typeof value === "object") {
    return sanitizeLogFields(value as Record<string, unknown>);
  }

  return value;
}

export function sanitizeLogFields(fields: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      continue;
    }

    sanitized[key] = sanitizeValue(key, value);
  }

  return sanitized;
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return sanitizeLogFields({
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  }

  return sanitizeLogFields({ message: String(error) });
}

function emitStdout(level: LogLevel, msg: string, fields: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...DEFAULT_CONTEXT,
    ...fields
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "warn") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

function emit(level: LogLevel, msg: string, fields: Record<string, unknown> = {}) {
  if (!shouldLog(level)) return;

  const sanitized = sanitizeLogFields(fields);
  emitStdout(level, msg, sanitized);

  const client = getLogtailClient();
  if (!client) return;

  const payload = { ...DEFAULT_CONTEXT, ...sanitized };
  void client[level](msg, payload).catch(() => {
    // Trust @logtail/node buffering; stdout already has the line.
  });
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields)
};

export async function flushLogger(): Promise<void> {
  if (!isBetterStackEnabled() || !logtailClient) return;
  await logtailClient.flush();
}
