import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export interface DatabaseHandle {
  db: NodePgDatabase<typeof schema>;
  close(): Promise<void>;
}

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(databaseUrl: string): DatabaseHandle {
  const pool = new Pool({ connectionString: databaseUrl });

  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
}

