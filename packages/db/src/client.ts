import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>;

export interface DbConfig {
  connectionString: string;
}

export function createDb(config: DbConfig) {
  const pool = new Pool({
    connectionString: config.connectionString
  });

  return drizzle(pool, { schema });
}
