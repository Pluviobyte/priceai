import { Pool, type QueryResultRow } from "pg";

const globalForDatabase = globalThis as typeof globalThis & {
  priceRadarPool?: Pool;
};

export const databasePool =
  globalForDatabase.priceRadarPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://price_radar:price_radar@127.0.0.1:5433/price_radar",
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.priceRadarPool = databasePool;
}

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const result = await databasePool.query<Row>(text, [...values]);
  return result.rows;
}
