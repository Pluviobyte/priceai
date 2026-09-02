import { Worker } from "bullmq";
import Redis from "ioredis";
import pino from "pino";
import { readWorkerConfig } from "./config.js";

const config = readWorkerConfig();
const logger = pino({ name: "price-radar-worker" });
const connection = new Redis(config.redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  "source-jobs",
  async (job) => {
    logger.info({ jobId: job.id, jobName: job.name }, "job received");

    switch (job.name) {
      case "source.probe":
      case "source.crawl":
      case "snapshot.publish":
        throw new Error(`job_handler_not_implemented:${job.name}`);
      default:
        throw new Error(`unknown_job:${job.name}`);
    }
  },
  {
    connection,
    concurrency: config.concurrency,
  },
);

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
  await worker.close();
  await connection.quit();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

logger.info({ concurrency: config.concurrency }, "worker started");

