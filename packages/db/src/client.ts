import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;
export type DbTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbExecutor = Database | DbTransaction;

export interface DbConfig {
  connectionString: string;
}

export function createDb(config: DbConfig) {
  const pool = new Pool({
    connectionString: config.connectionString,
    // Neon free tier can take a few seconds to wake; keep the pool small.
    max: 5,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 20_000
  });

  return drizzle(pool, { schema });
}
