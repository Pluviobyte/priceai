import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { InMemoryCollectorRegistry } from "@price-radar/collector-sdk";
import { createDatabase } from "@price-radar/database";
import {
  crawlSource,
  findDueSources,
  publishLatestSnapshots,
  seedCanonicalProducts,
} from "@price-radar/pipeline";
import { LdxpShopApiCollector } from "@price-radar/shop-api-collector";
import { readWorkerConfig } from "./config.js";

const config = readWorkerConfig();
const logger = pino({ name: "price-radar-worker" });
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue("source-jobs", { connection });
const database = createDatabase(config.databaseUrl);
const registry = new InMemoryCollectorRegistry();
registry.register(new LdxpShopApiCollector());

interface SourceJobData {
  sourceId?: unknown;
  sourceUrl?: unknown;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`invalid_job_field:${field}`);
  }
  return value;
}

const worker = new Worker(
  "source-jobs",
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "job received");

    switch (job.name) {
      case "source.probe": {
        const data = job.data as SourceJobData;
        const sourceUrl = new URL(requiredString(data.sourceUrl, "sourceUrl"));
        return registry.probe(sourceUrl, new AbortController().signal);
      }
      case "source.crawl": {
        const data = job.data as SourceJobData;
        const result = await crawlSource(
          database.db,
          registry,
          requiredString(data.sourceId, "sourceId"),
        );
        if (result.completeSnapshot) {
          await seedCanonicalProducts(database.db);
          const publication = await publishLatestSnapshots(database.db);
          return { ...result, publication };
        }
        return result;
      }
      case "snapshot.publish":
        await seedCanonicalProducts(database.db);
        return publishLatestSnapshots(database.db);
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

const schedulerTimer = setInterval(() => {
  void enqueueDueSources().catch((error: unknown) => {
    logger.error({ error }, "source scheduling failed");
  });
}, config.schedulerIntervalMs);
schedulerTimer.unref();
void enqueueDueSources().catch((error: unknown) => {
  logger.error({ error }, "initial source scheduling failed");
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
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ concurrency: config.concurrency }, "worker started");
