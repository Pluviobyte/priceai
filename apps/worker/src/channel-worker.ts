import { createDatabase } from "@price-radar/database";
import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { S3JsonObjectStore } from "@price-radar/object-storage";
import { runChannelCycle } from "./channel-cycle.js";
import { readWorkerConfig } from "./config.js";
import { createCollectorRegistry } from "./registry.js";

/**
 * Long-lived channel worker for Dokploy: no Redis, no external scheduler.
 * Every tick runs one channel cycle (discovery when due, vetting, crawling,
 * publishing) under a PostgreSQL advisory lock and writes a heartbeat file
 * that the container health check reads.
 */
const config = readWorkerConfig();
const database = createDatabase(config.databaseUrl);
const registry = createCollectorRegistry(database.db);
const rawObjectStore = config.objectStorageConfigured
  ? new S3JsonObjectStore({
      endpoint: config.objectStorageEndpoint,
      region: config.objectStorageRegion,
      bucket: config.objectStorageBucket,
      accessKeyId: config.objectStorageAccessKey,
      secretAccessKey: config.objectStorageSecretKey,
    })
  : undefined;
let stopping = false;
const idle = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { stopping = true; idle.abort(); });
const heartbeat = () => Promise.all([
  writeFile("/tmp/channel-worker-heartbeat", String(Date.now())),
  writeFile("/tmp/worker-heartbeat", String(Date.now())),
]).catch(() => undefined);
const timer = setInterval(() => { void heartbeat(); }, 30_000);
await heartbeat();
console.log(JSON.stringify({ event: "channel_worker_started", tickMs: config.channelWorkerTickMs, discovery: config.sourceDiscoveryEnabled, vettingBatch: config.candidateVettingBatch, crawlBatch: config.channelCrawlBatch }));
try {
  while (!stopping) {
    try {
      const result = await runChannelCycle(registry, config, {
        signal: idle.signal,
        ...(rawObjectStore ? { rawObjectStore } : {}),
        log: (event) => console.log(JSON.stringify(event)),
      });
      if (result.status !== "skipped" || result.reason !== "already_running") {
        console.log(JSON.stringify({ event: "channel_cycle", status: result.status, reason: result.reason, durationMs: result.durationMs, vetting: result.vetting, crawl: result.crawl, repair: result.repair, profiles: result.profiles }));
      }
    } catch (error) {
      if (!stopping) console.error(JSON.stringify({ event: "channel_cycle_failed", error: error instanceof Error ? error.stack ?? error.message : String(error) }));
    }
    if (!stopping) await setTimeout(config.channelWorkerTickMs, undefined, { signal: idle.signal }).catch(() => undefined);
  }
} finally {
  clearInterval(timer);
  rawObjectStore?.destroy();
  await database.close();
}
