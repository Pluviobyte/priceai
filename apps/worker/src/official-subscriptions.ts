import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { fetchOfficialDocuments } from "./official-document-fetcher.js";
import { readWorkerConfig } from "./config.js";
import { runSubscriptionSweep } from "./subscription-runner.js";

import { runTransitSweep } from "./transit-runner.js";

const config = readWorkerConfig();
let stopping = false;
const idle = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => { stopping = true; idle.abort(); });
const heartbeat = () => Promise.all([writeFile("/tmp/official-worker-heartbeat", String(Date.now())), writeFile("/tmp/worker-heartbeat", String(Date.now()))]).catch(() => undefined);
const timer = setInterval(() => { void heartbeat(); }, 30_000);
await heartbeat();
const transitLoop = (async () => {
  while (!stopping) {
    try {
      const result = await runTransitSweep(config.databaseUrl);
      if (result.status !== "skipped") console.log(JSON.stringify({ event: "transit_catalog_sweep", ...result }));
    } catch (error) { console.error(error); }
    if (!stopping) await setTimeout(60_000, undefined, { signal: idle.signal }).catch(() => undefined);
  }
})();
try {
  while (!stopping) {
    try {
      const result = await runSubscriptionSweep(config.databaseUrl, {
        intervalMs: config.officialSubscriptionRefreshIntervalMs,
        onProgress: (source, result) => console.log(JSON.stringify({event:"official_source_completed",source,...result})),
        fetchDocuments: urls => fetchOfficialDocuments(urls, config.browserExecutablePath),
      });
      if (result.status !== "skipped") console.log(JSON.stringify({event: "official_subscription_sweep", ...result}));
    } catch (error) { console.error(error); }
    if (!stopping) await setTimeout(60_000, undefined, {signal: idle.signal}).catch(() => undefined);
  }
} finally { stopping = true; idle.abort(); await transitLoop; clearInterval(timer); }
