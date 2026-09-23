import { writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import { fetchDocumentsWithBrowser } from "@price-radar/browser-collector";
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
        fetchDocuments: urls => fetchDocumentsWithBrowser(urls, { ...(config.browserExecutablePath ? { executablePath: config.browserExecutablePath } : {}), ...(urls.every(url => new URL(url).hostname === "x.ai") ? { includeHtml: true, navigationTimeoutMs: 15_000, challengeWaitMs: 0 } : {}) }),
      });
      if (result.status !== "skipped") console.log(JSON.stringify({event: "official_subscription_sweep", ...result}));
    } catch (error) { console.error(error); }
    if (!stopping) await setTimeout(60_000, undefined, {signal: idle.signal}).catch(() => undefined);
  }
} finally { stopping = true; idle.abort(); await transitLoop; clearInterval(timer); }
