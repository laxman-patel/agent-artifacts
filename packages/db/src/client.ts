import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | DbTransaction;

export interface DbConfig {
  connectionString: string;
}

const DB_CONNECTION_TIMEOUT_MS = 30_000;
const DB_IDLE_TIMEOUT_MS = 5 * 60_000;
const DB_KEEP_ALIVE_INITIAL_DELAY_MS = 10_000;

export function createDb(config: DbConfig) {
  const pool = new Pool({
    connectionString: config.connectionString,
    // Keep the pool small for Neon, but avoid churning fresh TCP/TLS connections between page views.
    max: 5,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
    keepAlive: true,
    keepAliveInitialDelayMillis: DB_KEEP_ALIVE_INITIAL_DELAY_MS
  });

  return drizzle(pool, { schema });
}
