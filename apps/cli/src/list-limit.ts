import type { CliConfig } from "./config.js";
import { CliError } from "./errors.js";

export const DEFAULT_LIST_LIMIT = 50;
export const MAX_LIST_LIMIT = 100;

export interface ListLimitResult {
  /** Limit to pass to APIs; undefined means fetch all. */
  apiLimit: number | undefined;
  /** Limit for client-side slicing; undefined means no slice. */
  clientLimit: number | undefined;
  all: boolean;
}

export function resolveListLimit(
  options: Record<string, unknown>,
  defaultLimit = DEFAULT_LIST_LIMIT
): ListLimitResult {
  const all = options.all === true;
  if (all) {
    return { apiLimit: undefined, clientLimit: undefined, all: true };
  }

  const raw = options.limit as number | undefined;
  if (raw !== undefined && (!Number.isInteger(raw) || raw < 1 || raw > MAX_LIST_LIMIT)) {
    throw new CliError(
      "invalid_request",
      `--limit must be an integer between 1 and ${MAX_LIST_LIMIT}; got ${raw}. Use --all for every record.`,
      2
    );
  }
  const limit = raw ?? defaultLimit;
  return { apiLimit: limit, clientLimit: limit, all: false };
}

export function sliceListResult<T>(
  items: T[],
  limitResult: ListLimitResult,
  config: CliConfig,
  label: string
): { items: T[]; total: number; truncated: boolean } {
  const total = items.length;
  if (limitResult.all || limitResult.clientLimit === undefined) {
    return { items, total, truncated: false };
  }

  const limit = limitResult.clientLimit;
  const sliced = items.slice(0, limit);
  const truncated = sliced.length < total;
  if (truncated && !config.quiet) {
    process.stderr.write(
      `(showing ${sliced.length} of ${total} ${label}; pass --limit <n> or --all for more)\n`
    );
  }
  return { items: sliced, total, truncated };
}
