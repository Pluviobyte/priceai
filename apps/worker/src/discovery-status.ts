/** Read-only entry point for the restricted production monitor. Never runs discovery. */
import { stat } from "node:fs/promises";
import { createDatabase } from "@price-radar/database";
import { DIRECTORY_PROVIDERS, selectDirectoryProviders, readDiscoveryHealth } from "@price-radar/pipeline";
import { readWorkerConfig } from "./config.js";
const config=readWorkerConfig();
const enabledDirectories=new Set(selectDirectoryProviders().map(provider=>provider.id));
const schedules=[
  ...DIRECTORY_PROVIDERS.map(provider=>({provider:provider.id,kind:"directory",enabled:config.sourceDiscoveryEnabled&&enabledDirectories.has(provider.id),intervalMs:config.sourceDirectoryImportIntervalMs})),
  {provider:"16688_source_marketplace",kind:"platform",enabled:config.sourceDiscoveryEnabled,intervalMs:config.sourceDirectoryImportIntervalMs},
  {provider:"crawled_catalog_links",kind:"crawl",enabled:config.sourceDiscoveryEnabled&&config.linkDiscoveryEnabled,intervalMs:config.autonomousDiscoveryIntervalMs},
  {provider:"telegram_public_channels",kind:"community",enabled:config.sourceDiscoveryEnabled&&config.telegramDiscoveryEnabled,intervalMs:config.autonomousDiscoveryIntervalMs},
  {provider:"github_topic_readmes",kind:"community",enabled:config.sourceDiscoveryEnabled&&config.githubDiscoveryEnabled,intervalMs:config.autonomousDiscoveryIntervalMs*7},
];
const handle=createDatabase(config.databaseUrl);
try {
  const startedAt=(await stat("/tmp/channel-worker-heartbeat").catch(()=>null))?.birthtime ?? new Date(0);
  console.log(JSON.stringify(await readDiscoveryHealth(handle.db,schedules,startedAt)));
} finally { await handle.close(); }
