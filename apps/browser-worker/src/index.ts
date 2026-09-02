import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { BrowserCollector } from "@price-radar/browser-collector";
import { InMemoryCollectorRegistry } from "@price-radar/collector-sdk";
import { createDatabase, errorEvents, systemMetricSamples } from "@price-radar/database";
import { S3JsonObjectStore } from "@price-radar/object-storage";
import { crawlSource } from "@price-radar/pipeline";

const logger = pino({ name: "price-radar-browser-worker" });
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const databaseUrl = process.env.BROWSER_DATABASE_URL ?? process.env.DATABASE_URL ?? "postgresql://price_radar:price_radar@127.0.0.1:5433/price_radar";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
const publishQueue = new Queue("source-jobs", { connection });
const database = createDatabase(databaseUrl);
const objectStore = new S3JsonObjectStore({
  endpoint: process.env.OBJECT_STORAGE_ENDPOINT ?? "http://127.0.0.1:9000",
  region: process.env.OBJECT_STORAGE_REGION ?? "auto",
  bucket: process.env.OBJECT_STORAGE_BUCKET ?? "price-radar-snapshots",
  accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY ?? "minio",
  secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY ?? "minio-secret",
});
const registry = new InMemoryCollectorRegistry();
registry.register(new BrowserCollector(process.env.BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH } : {}));

const worker = new Worker("browser-source-jobs", async (job) => {
  if (job.name !== "source.crawl" || typeof job.data?.sourceId !== "string") throw new Error("invalid_browser_job");
  const result = await crawlSource(database.db, registry, job.data.sourceId, { rawObjectStore: objectStore });
  if (result.completeSnapshot) await publishQueue.add("snapshot.publish", {}, { jobId: `publish-after-browser-${result.runId}`, removeOnComplete: 100, removeOnFail: 500 });
  return result;
}, { connection, concurrency: Math.max(1, Math.min(2, Number(process.env.BROWSER_WORKER_CONCURRENCY ?? 1))) });

worker.on("completed", (job) => {
  const duration = job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
  logger.info({ jobId: job.id, duration }, "browser job completed");
  void database.db.insert(systemMetricSamples).values({ service: "browser-worker", metric: "job_duration", value: String(duration), unit: "milliseconds", labels: { outcome: "completed" } });
});
worker.on("failed", (job, error) => {
  logger.error({ jobId: job?.id, error }, "browser job failed");
  void database.db.insert(errorEvents).values({ service: "browser-worker", operation: job?.name ?? "unknown", errorCode: error.name, message: error.message.slice(0, 2000), context: { jobId: job?.id ?? null } });
});

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  await worker.close();
  await publishQueue.close();
  await connection.quit();
  await database.close();
  objectStore.destroy();
}
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
logger.info("isolated browser worker started");
