export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  concurrency: number;
  schedulerIntervalMs: number;
}

export function readWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return {
    databaseUrl:
      env.DATABASE_URL ??
      "postgresql://price_radar:price_radar@127.0.0.1:5433/price_radar",
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    concurrency: Number(env.WORKER_CONCURRENCY ?? 4),
    schedulerIntervalMs: Number(env.SCHEDULER_INTERVAL_MS ?? 30_000),
  };
}
