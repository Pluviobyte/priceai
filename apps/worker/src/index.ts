import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { InMemoryCollectorRegistry } from "@price-radar/collector-sdk";
import { BrowserCollector } from "@price-radar/browser-collector";
import { createDatabase } from "@price-radar/database";
import { DujiaoCollector } from "@price-radar/dujiao-collector";
import { GenericHtmlCollector } from "@price-radar/generic-html-collector";
import { KamiCollector } from "@price-radar/kami-collector";
import {
  assertSafePublicUrl,
  crawlSource,
  deliverNotificationOutbox,
  evaluatePriceAlerts,
  findDueSources,
  findPendingSourceSubmissions,
  precheckSourceSubmission,
  publishLatestSnapshots,
  seedCanonicalProducts,
} from "@price-radar/pipeline";
import { LdxpShopApiCollector } from "@price-radar/shop-api-collector";
import { S3JsonObjectStore } from "@price-radar/object-storage";
import { readWorkerConfig } from "./config.js";

const config = readWorkerConfig();
const logger = pino({ name: "price-radar-worker" });
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("source-jobs", { connection });
const database = createDatabase(config.databaseUrl);
const rawObjectStore = new S3JsonObjectStore({
  endpoint: config.objectStorageEndpoint,
  region: config.objectStorageRegion,
  bucket: config.objectStorageBucket,
  accessKeyId: config.objectStorageAccessKey,
  secretAccessKey: config.objectStorageSecretKey,
});
const registry = new InMemoryCollectorRegistry();
registry.register(new LdxpShopApiCollector());
registry.register(new KamiCollector());
registry.register(new DujiaoCollector());
registry.register(new GenericHtmlCollector());
registry.register(
  new BrowserCollector({
    ...(config.browserExecutablePath
      ? { executablePath: config.browserExecutablePath }
      : {}),
  }),
);

interface SourceJobData {
  sourceId?: unknown;
  sourceUrl?: unknown;
  submissionId?: unknown;
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
  const alerts = await evaluatePriceAlerts(database.db, publication.generationId);
  return { ...publication, alerts };
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
      case "snapshot.publish":
        return publishAndEvaluate();
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
      return queue.add(
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

async function deliverNotifications(): Promise<void> {
  if (!config.notificationWebhookUrl || !config.notificationWebhookSecret) return;
  const result = await deliverNotificationOutbox(database.db, {
    url: config.notificationWebhookUrl,
    secret: config.notificationWebhookSecret,
  });
  if (result.attempted > 0) logger.info(result, "notification outbox processed");
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
}, config.schedulerIntervalMs);
schedulerTimer.unref();
void enqueueDueSources().catch((error: unknown) => {
  logger.error({ error }, "initial source scheduling failed");
});
void enqueuePendingSubmissions().catch((error: unknown) => {
  logger.error({ error }, "initial submission scheduling failed");
});
void deliverNotifications().catch((error: unknown) => {
  logger.error({ error }, "initial notification delivery failed");
});

worker.on("completed", (job) => {
  logger.info({ jobId: job.id, jobName: job.name }, "job completed");
});

worker.on("failed", (job, error) => {
  logger.error(
    { jobId: job?.id, jobName: job?.name, error },
    "job failed",
  );
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  clearInterval(schedulerTimer);
  await worker.close();
  await queue.close();
  await connection.quit();
  await database.close();
  rawObjectStore.destroy();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ concurrency: config.concurrency }, "worker started");
