export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  concurrency: number;
  schedulerIntervalMs: number;
  browserExecutablePath?: string;
  notificationWebhookUrl?: string;
  notificationWebhookSecret?: string;
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
    ...(env.BROWSER_EXECUTABLE_PATH
      ? { browserExecutablePath: env.BROWSER_EXECUTABLE_PATH }
      : {}),
    ...(env.NOTIFICATION_WEBHOOK_URL
      ? { notificationWebhookUrl: env.NOTIFICATION_WEBHOOK_URL }
      : {}),
    ...(env.NOTIFICATION_WEBHOOK_SECRET
      ? { notificationWebhookSecret: env.NOTIFICATION_WEBHOOK_SECRET }
      : {}),
  };
}
