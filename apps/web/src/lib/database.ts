import { Pool, type QueryResultRow } from "pg";

const numberFromEnvironment = (name: string, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.floor(parsed))) : fallback;
};

const poolMax = numberFromEnvironment("WEB_DATABASE_POOL_MAX", 6, 1, 10);
const statementTimeoutMs = numberFromEnvironment("WEB_DATABASE_STATEMENT_TIMEOUT_MS", 10_000, 1_000, 30_000);

interface QueryMetrics {
  inFlight: number;
  peakInFlight: number;
  completed: number;
  failed: number;
  timedOut: number;
  slow: number;
  totalDurationMs: number;
}

const globalForDatabase = globalThis as typeof globalThis & {
  priceRadarPool?: Pool;
  priceRadarQueryMetrics?: QueryMetrics;
};

const queryMetrics = globalForDatabase.priceRadarQueryMetrics ?? {
  inFlight: 0,
  peakInFlight: 0,
  completed: 0,
  failed: 0,
  timedOut: 0,
  slow: 0,
  totalDurationMs: 0,
};
globalForDatabase.priceRadarQueryMetrics = queryMetrics;

export const databasePool =
  globalForDatabase.priceRadarPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://price_radar:price_radar@127.0.0.1:5433/price_radar",
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: statementTimeoutMs,
    query_timeout: statementTimeoutMs + 1_000,
  });

// Idle connections also emit errors when PostgreSQL restarts. Keep the HTTP
// process alive so readiness can report the outage and the pool can reconnect.
if (databasePool.listenerCount("error") === 0) {
  databasePool.on("error", () => {
    console.error("Database idle connection lost");
  });
}

// Next.js can load route bundles independently. One process-wide pool makes the
// configured maximum a real Web-service boundary instead of a per-route limit.
globalForDatabase.priceRadarPool = databasePool;

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<Row[]> {
  const started = performance.now();
  // Includes both executing statements and callers waiting for a pool slot.
  queryMetrics.inFlight++;
  queryMetrics.peakInFlight = Math.max(queryMetrics.peakInFlight, queryMetrics.inFlight);
  try {
    const result = await databasePool.query<Row>(text, [...values]);
    queryMetrics.completed++;
    return result.rows;
  } catch (error) {
    queryMetrics.failed++;
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "57014" || error instanceof Error && /timeout|statement timeout/i.test(error.message)) queryMetrics.timedOut++;
    throw error;
  } finally {
    const duration = performance.now() - started;
    queryMetrics.totalDurationMs += duration;
    if (duration >= 2_000) queryMetrics.slow++;
    queryMetrics.inFlight--;
  }
}

export function getDatabaseMetrics() {
  return {
    ...queryMetrics,
    averageDurationMs: queryMetrics.completed + queryMetrics.failed > 0
      ? queryMetrics.totalDurationMs / (queryMetrics.completed + queryMetrics.failed) : 0,
    poolTotal: databasePool.totalCount,
    poolIdle: databasePool.idleCount,
    poolBusy: databasePool.totalCount - databasePool.idleCount,
    poolWaiting: databasePool.waitingCount,
    poolMax,
    statementTimeoutMs,
  };
}
