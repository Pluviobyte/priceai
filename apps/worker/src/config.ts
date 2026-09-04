export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  concurrency: number;
  schedulerIntervalMs: number;
  priceRefreshIntervalMs: number;
  browserExecutablePath?: string;
  notificationWebhookUrl?: string;
  notificationWebhookSecret?: string;
  objectStorageEndpoint: string;
  objectStorageRegion: string;
  objectStorageBucket: string;
  objectStorageAccessKey: string;
  objectStorageSecretKey: string;
}

export function readWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return {
    databaseUrl:
      env.WORKER_DATABASE_URL ?? env.DATABASE_URL ??
      "postgresql://price_radar:price_radar@127.0.0.1:5433/price_radar",
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    concurrency: Number(env.WORKER_CONCURRENCY ?? 4),
    schedulerIntervalMs: Number(env.SCHEDULER_INTERVAL_MS ?? 30_000),
    priceRefreshIntervalMs: Number(env.PRICE_REFRESH_INTERVAL_MS ?? 60 * 60 * 1_000),
    ...(env.BROWSER_EXECUTABLE_PATH
      ? { browserExecutablePath: env.BROWSER_EXECUTABLE_PATH }
      : {}),
    ...(env.NOTIFICATION_WEBHOOK_URL
      ? { notificationWebhookUrl: env.NOTIFICATION_WEBHOOK_URL }
      : {}),
    ...(env.NOTIFICATION_WEBHOOK_SECRET
      ? { notificationWebhookSecret: env.NOTIFICATION_WEBHOOK_SECRET }
      : {}),
    objectStorageEndpoint: env.OBJECT_STORAGE_ENDPOINT ?? "http://127.0.0.1:9000",
    objectStorageRegion: env.OBJECT_STORAGE_REGION ?? "auto",
    objectStorageBucket: env.OBJECT_STORAGE_BUCKET ?? "price-radar-snapshots",
    objectStorageAccessKey: env.OBJECT_STORAGE_ACCESS_KEY ?? "minio",
    objectStorageSecretKey: env.OBJECT_STORAGE_SECRET_KEY ?? "minio-secret",
  };
}
