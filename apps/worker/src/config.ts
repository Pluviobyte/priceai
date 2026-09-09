export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  concurrency: number;
  schedulerIntervalMs: number;
  priceRefreshIntervalMs: number;
  officialSubscriptionRefreshIntervalMs: number;
  /** Channel worker: pause between cycles of discovery → vetting → crawl → publish. */
  channelWorkerTickMs: number;
  /** Channel worker: how often public shop directories and platform marketplaces are re-read. */
  sourceDirectoryImportIntervalMs: number;
  /** Channel worker: candidates vetted per cycle (each one costs a probe and a trial crawl). */
  candidateVettingBatch: number;
  /** Channel worker: due sources crawled per cycle. */
  channelCrawlBatch: number;
  channelPlatformConcurrency: number;
  /** Channel worker: age after which a source quality profile is recomputed. */
  qualityProfileMaxAgeMs: number;
  /** Master switch for automatic source discovery and vetting. */
  sourceDiscoveryEnabled: boolean;
  browserExecutablePath?: string;
  notificationWebhookUrl?: string;
  notificationWebhookSecret?: string;
  objectStorageEndpoint: string;
  objectStorageRegion: string;
  objectStorageBucket: string;
  objectStorageAccessKey: string;
  objectStorageSecretKey: string;
  /** True only when object storage was configured explicitly; the channel worker then stores raw manifests. */
  objectStorageConfigured: boolean;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === "" ? Number.NaN : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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
    officialSubscriptionRefreshIntervalMs: Number(env.OFFICIAL_SUBSCRIPTION_REFRESH_INTERVAL_MS ?? 24 * 60 * 60 * 1_000),
    channelWorkerTickMs: positiveNumber(env.CHANNEL_WORKER_TICK_MS, 5_000),
    sourceDirectoryImportIntervalMs: positiveNumber(env.SOURCE_DIRECTORY_IMPORT_INTERVAL_MS, 24 * 60 * 60 * 1_000),
    candidateVettingBatch: positiveNumber(env.CANDIDATE_VETTING_BATCH, 20),
    channelCrawlBatch: positiveNumber(env.CHANNEL_CRAWL_BATCH, 50),
    channelPlatformConcurrency: Math.min(8, Math.max(1, Math.floor(positiveNumber(env.CHANNEL_PLATFORM_CONCURRENCY, 4)))),
    qualityProfileMaxAgeMs: positiveNumber(env.QUALITY_PROFILE_MAX_AGE_MS, 7 * 24 * 60 * 60 * 1_000),
    sourceDiscoveryEnabled: (env.SOURCE_DISCOVERY_ENABLED ?? "true").toLowerCase() !== "false",
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
    objectStorageConfigured: Boolean(env.OBJECT_STORAGE_ENDPOINT && env.OBJECT_STORAGE_ACCESS_KEY && env.OBJECT_STORAGE_SECRET_KEY),
  };
}
