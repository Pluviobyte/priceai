import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { createDatabase, errorEvents, operatorJobRequests, systemMetricSamples } from "@price-radar/database";
import { eq, sql } from "drizzle-orm";
import {
  assertSafePublicUrl,
  checkAggregatorCoverage,
  crawlSource,
  deliverNotificationOutbox,
  discoverSourcesWithBrave,
  discoverSourcesWithGrok,
  enumerate16688SourceMarketplace,
  evaluatePriceAlerts,
  findDueSources,
  findPendingSourceSubmissions,
  importSourceDirectories,
  precheckSourceSubmission,
  publishLatestSnapshots,
  refreshSourceQualityProfiles,
  repairShopApiEntryUrls,
  seedCanonicalProducts,
  storePublicGenerationSnapshot,
  vetNextCandidates,
} from "@price-radar/pipeline";
import { S3JsonObjectStore } from "@price-radar/object-storage";
import { createCollectorRegistry } from "./registry.js";
import {
  refreshAllTransitProviders,
  refreshOfficialSubscriptionChannels,
  seedVerifiedOfficialApiPrices,
} from "@price-radar/price-channels";
import { readWorkerConfig } from "./config.js";

const config = readWorkerConfig();
const logger = pino({ name: "price-radar-worker" });
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("source-jobs", { connection });
const browserQueue = new Queue("browser-source-jobs", { connection });
const database = createDatabase(config.databaseUrl);
const rawObjectStore = new S3JsonObjectStore({
  endpoint: config.objectStorageEndpoint,
  region: config.objectStorageRegion,
  bucket: config.objectStorageBucket,
  accessKeyId: config.objectStorageAccessKey,
  secretAccessKey: config.objectStorageSecretKey,
});
const registry = createCollectorRegistry(database.db);

interface SourceJobData {
  sourceId?: unknown;
  sourceUrl?: unknown;
  submissionId?: unknown;
  requestId?: unknown;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_job_field:${field}`);
  }
  return value;
}

async function publishAndEvaluate() {
  await seedCanonicalProducts(database.db);
  const publication = await publishLatestSnapshots(database.db);
  let publicSnapshot: Awaited<ReturnType<typeof storePublicGenerationSnapshot>> | null = null;
  let snapshotError: string | null = null;
  try { publicSnapshot = await storePublicGenerationSnapshot(database.db, rawObjectStore, publication.generationId); }
  catch (error) {
    snapshotError = error instanceof Error ? error.message : "public_snapshot_store_failed";
    await database.db.insert(errorEvents).values({ service: "worker", operation: "public_generation_snapshot", errorCode: "object_store_failed", message: snapshotError.slice(0, 2000), context: { generationId: publication.generationId } });
  }
  const alerts = await evaluatePriceAlerts(database.db, publication.generationId);
  return { ...publication, publicSnapshot, snapshotError, alerts };
}

const worker = new Worker(
  "source-jobs",
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "job received");

    switch (job.name) {
      case "source.probe": {
        const data = job.data as SourceJobData;
        const sourceUrl = await assertSafePublicUrl(requiredString(data.sourceUrl, "sourceUrl"));
        return registry.probe(sourceUrl, new AbortController().signal);
      }
      case "source.crawl": {
        const data = job.data as SourceJobData;
        const result = await crawlSource(
          database.db,
          registry,
          requiredString(data.sourceId, "sourceId"),
          { rawObjectStore },
        );
        if (result.completeSnapshot) {
          const publication = await publishAndEvaluate();
          return { ...result, publication };
        }
        return result;
      }
      case "submission.precheck": {
        const data = job.data as SourceJobData;
        return precheckSourceSubmission(
          database.db,
          registry,
          requiredString(data.submissionId, "submissionId"),
          new AbortController().signal,
          rawObjectStore,
        );
      }
      case "snapshot.publish": {
        const requestId = typeof (job.data as SourceJobData).requestId === "string" ? (job.data as SourceJobData).requestId as string : null;
        try {
          const result = await publishAndEvaluate();
          if (requestId) await database.db.update(operatorJobRequests).set({ status: "success", result, finishedAt: new Date() }).where(eq(operatorJobRequests.id, requestId));
          return result;
        } catch (error) {
          if (requestId) await database.db.update(operatorJobRequests).set({ status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 2000) : "publish_failed", finishedAt: new Date() }).where(eq(operatorJobRequests.id, requestId));
          throw error;
        }
      }
      case "prices.subscriptions.refresh":
        throw new Error("Use the dedicated Dokploy official subscription worker");
      case "prices.official_api.refresh":
        return seedVerifiedOfficialApiPrices(database.db);
      case "prices.transit.refresh":
        return refreshAllTransitProviders(database.db);
      default:
        throw new Error(`unknown_job:${job.name}`);
    }
  },
  {
    connection,
    concurrency: config.concurrency,
  },
);

async function enqueueDueSources(): Promise<void> {
  const now = new Date();
  const dueSources = await findDueSources(database.db, now);
  await Promise.all(
    dueSources.map((source) => {
      const scheduledFor = source.nextRunAt?.getTime() ?? 0;
      const targetQueue = source.collectorKind === "browser" ? browserQueue : queue;
      return targetQueue.add(
        "source.crawl",
        { sourceId: source.id },
        {
          jobId: `crawl-${source.id}-${scheduledFor}`,
          attempts: 1,
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 86_400, count: 5_000 },
        },
      );
    }),
  );
  if (dueSources.length > 0) {
    logger.info({ sourceCount: dueSources.length }, "due sources enqueued");
  }
}

async function enqueuePendingSubmissions(): Promise<void> {
  const submissions = await findPendingSourceSubmissions(database.db);
  await Promise.all(
    submissions.map((submission) =>
      queue.add(
        "submission.precheck",
        { submissionId: submission.id },
        {
          jobId: `submission-${submission.id}-${submission.updatedAt.getTime()}`,
          attempts: 1,
          removeOnComplete: { age: 3_600, count: 1_000 },
          removeOnFail: { age: 86_400, count: 5_000 },
        },
      ),
    ),
  );
  if (submissions.length > 0) {
    logger.info({ submissionCount: submissions.length }, "source submissions enqueued");
  }
}

async function enqueueOperatorRequests(): Promise<void> {
  await database.db.execute(sql`update operator_job_requests set status='pending',started_at=null,error_message='recovered abandoned operator request' where kind='publish' and status='running' and started_at<now()-interval '15 minutes'`);
  const claimed = await database.db.execute(sql`update operator_job_requests set status='running',started_at=now() where id=(select id from operator_job_requests where kind='publish' and status='pending' order by created_at for update skip locked limit 1) returning id,started_at`);
  const row = claimed.rows[0] as { id?: string; started_at?: Date } | undefined;
  if (row?.id) await queue.add("snapshot.publish", { requestId: row.id }, { jobId: `operator-publish-${row.id}-${row.started_at?.getTime() ?? Date.now()}`, attempts: 1, removeOnComplete: 100, removeOnFail: 500 });
}

async function deliverNotifications(): Promise<void> {
  if (!config.notificationWebhookUrl || !config.notificationWebhookSecret) return;
  const result = await deliverNotificationOutbox(database.db, {
    url: config.notificationWebhookUrl,
    secret: config.notificationWebhookSecret,
  });
  if (result.attempted > 0) logger.info(result, "notification outbox processed");
}

async function refreshPriceChannels(): Promise<void> {
  const [officialApi, transit] = await Promise.all([
    seedVerifiedOfficialApiPrices(database.db),
    refreshAllTransitProviders(database.db),
  ]);
  logger.info({ officialApi, transit }, "official and transit price channels refreshed");
}

async function runSourceDiscovery(): Promise<void> {
  if (!config.sourceDiscoveryEnabled) return;
  const query = process.env.SOURCE_DISCOVERY_QUERY ?? "AI subscription card shop ChatGPT Plus Claude Pro 发卡";
  // Directories and the 16688 marketplace are candidates only; vetting decides what becomes a source.
  const directories = await importSourceDirectories(database.db, { minIntervalMs: config.sourceDirectoryImportIntervalMs });
  logger.info({ directories }, "source directories imported");
  await enumerate16688SourceMarketplace(database.db, { minIntervalMs: config.sourceDirectoryImportIntervalMs }).catch((error: unknown) => logger.error({ error }, "16688 marketplace enumeration failed"));
  if (process.env.XAI_API_KEY) await discoverSourcesWithGrok(database.db, { apiKey: process.env.XAI_API_KEY, query });
  if (process.env.BRAVE_SEARCH_API_KEY) await discoverSourcesWithBrave(database.db, { apiKey: process.env.BRAVE_SEARCH_API_KEY, query });
  for (const feed of (process.env.AGGREGATOR_FEED_URLS ?? "").split(",").map((item) => item.trim()).filter(Boolean)) await checkAggregatorCoverage(database.db, feed);
}

let maintenanceRunning = false;
async function runChannelMaintenance(): Promise<void> {
  if (!config.sourceDiscoveryEnabled || maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    const repair = await repairShopApiEntryUrls(database.db, registry, { limit: 10 });
    const vetting = await vetNextCandidates(database.db, registry, { limit: config.candidateVettingBatch, ...(config.objectStorageConfigured ? { rawObjectStore } : {}) });
    const profiles = await refreshSourceQualityProfiles(database.db, { limit: 10, maxAgeMs: config.qualityProfileMaxAgeMs });
    if (repair.repaired > 0 || vetting.attempted > 0 || profiles.refreshed > 0) {
      const { results, ...counts } = vetting;
      logger.info({ repair, vetting: counts, decisions: results.map((item) => ({ id: item.candidateId, status: item.status, reasons: item.reasons })), profiles }, "channel maintenance completed");
    }
  } finally {
    maintenanceRunning = false;
  }
}

const schedulerTimer = setInterval(() => {
  void enqueueDueSources().catch((error: unknown) => {
    logger.error({ error }, "source scheduling failed");
  });
  void enqueuePendingSubmissions().catch((error: unknown) => {
    logger.error({ error }, "submission scheduling failed");
  });
  void deliverNotifications().catch((error: unknown) => {
    logger.error({ error }, "notification delivery failed");
  });
  void enqueueOperatorRequests().catch((error: unknown) => logger.error({ error }, "operator request scheduling failed"));
}, config.schedulerIntervalMs);
schedulerTimer.unref();
const priceRefreshTimer = setInterval(() => {
  void refreshPriceChannels().catch((error: unknown) => logger.error({ error }, "price channel refresh failed"));
}, config.priceRefreshIntervalMs);
priceRefreshTimer.unref();
const discoveryTimer = setInterval(() => {
  void runSourceDiscovery().catch((error: unknown) => logger.error({ error }, "source discovery failed"));
}, 24 * 60 * 60 * 1_000);
discoveryTimer.unref();
const maintenanceTimer = setInterval(() => {
  void runChannelMaintenance().catch((error: unknown) => logger.error({ error }, "channel maintenance failed"));
}, 5 * 60 * 1_000);
maintenanceTimer.unref();
void enqueueDueSources().catch((error: unknown) => {
  logger.error({ error }, "initial source scheduling failed");
});
void enqueuePendingSubmissions().catch((error: unknown) => {
  logger.error({ error }, "initial submission scheduling failed");
});
void deliverNotifications().catch((error: unknown) => {
  logger.error({ error }, "initial notification delivery failed");
});
void enqueueOperatorRequests().catch((error: unknown) => logger.error({ error }, "initial operator request scheduling failed"));
void refreshPriceChannels().catch((error: unknown) => {
  logger.error({ error }, "initial price channel refresh failed");
});
if (config.sourceDiscoveryEnabled) {
  void runSourceDiscovery()
    .then(() => runChannelMaintenance())
    .catch((error: unknown) => logger.error({ error }, "initial source discovery failed"));
}

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, "job completed");
  const duration = job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  void database.db.insert(systemMetricSamples).values({ service: "worker", metric: "job_duration", value: String(duration), unit: "milliseconds", labels: { job: job.name, outcome: "completed" } }).catch((error: unknown) => logger.error({ error }, "metric persistence failed"));
});

worker.on("failed", (job, error) => {
  logger.error(
    { jobId: job?.id, jobName: job?.name, error },
    "job failed",
  );
  const duration = job?.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  void Promise.all([
    database.db.insert(systemMetricSamples).values({ service: "worker", metric: "job_duration", value: String(duration), unit: "milliseconds", labels: { job: job?.name ?? "unknown", outcome: "failed" } }),
    database.db.insert(errorEvents).values({ service: "worker", operation: job?.name ?? "unknown", errorCode: error.name || "worker_job_failed", message: error.message.slice(0, 2000), context: { jobId: job?.id ?? null } }),
  ]).catch((persistError: unknown) => logger.error({ error: persistError }, "failure telemetry persistence failed"));
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  clearInterval(schedulerTimer);
  clearInterval(priceRefreshTimer);
  clearInterval(discoveryTimer);
  clearInterval(maintenanceTimer);
  await worker.close();
  await browserQueue.close();
  await queue.close();
  await connection.quit();
  await database.close();
  rawObjectStore.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ concurrency: config.concurrency }, "worker started");
