import { setTimeout as delay } from "node:timers/promises";
import type { Database } from "@price-radar/database";
import { importSourceDirectories, enumerate16688SourceMarketplace, mineCrawledCatalogLinks,
  discoverTelegramChannels, discoverGithubTopicReadmes } from "@price-radar/pipeline";
import type { WorkerConfig } from "./config.js";
import type { ChannelCycleOptions, ChannelCycleResult } from "./channel-cycle.js";

export const discoveryProviders = { importSourceDirectories, enumerate16688SourceMarketplace,
  mineCrawledCatalogLinks, discoverTelegramChannels, discoverGithubTopicReadmes };

/** Sequential provider pass; individual providers enforce durable schedules. */
export async function runDiscoveryPass(db: Database, config: WorkerConfig, options: ChannelCycleOptions,
  providers = discoveryProviders) {
  const { importSourceDirectories, enumerate16688SourceMarketplace, mineCrawledCatalogLinks,
    discoverTelegramChannels, discoverGithubTopicReadmes } = providers;
  const signal = options.signal ?? new AbortController().signal;
  const log = options.log ?? (() => undefined);
  const result: Pick<ChannelCycleResult, "discovery" | "marketplace" | "crawledLinks" | "telegram" | "github"> = {};
  if (config.sourceDiscoveryEnabled && !options.skipDiscovery) {
    const minIntervalMs = options.forceDiscovery ? undefined : config.sourceDirectoryImportIntervalMs;
    result.discovery = await importSourceDirectories(db, { signal, ...(minIntervalMs ? { minIntervalMs } : {}) });
    log({ event: "directory_import", result: result.discovery });
    try {
      result.marketplace = await enumerate16688SourceMarketplace(db, { signal, allCategories: config.sixteen688AllCategories, ...(minIntervalMs ? { minIntervalMs } : {}) });
      log({ event: "marketplace_enumeration", result: result.marketplace });
    } catch (error) {
      result.marketplace = { status: "failed", error: error instanceof Error ? error.message : String(error) };
      log({ event: "marketplace_enumeration_failed", error: String(error) });
    }
    // Autonomous channels: our own crawled catalogs, public Telegram channels and GitHub topic READMEs.
    const autonomousInterval = options.forceDiscovery ? undefined : config.autonomousDiscoveryIntervalMs;
    const autonomous: Array<[keyof ChannelCycleResult & ("crawledLinks" | "telegram" | "github"), boolean, () => Promise<unknown>]> = [
      ["crawledLinks", config.linkDiscoveryEnabled, () => mineCrawledCatalogLinks(db, { signal, ...(autonomousInterval ? { minIntervalMs: autonomousInterval } : {}) })],
      ["telegram", config.telegramDiscoveryEnabled, () => discoverTelegramChannels(db, { signal, ...(autonomousInterval ? { minIntervalMs: autonomousInterval } : {}) })],
      ["github", config.githubDiscoveryEnabled, () => discoverGithubTopicReadmes(db, { signal, ...(config.githubDiscoveryTopics.length ? { topics: config.githubDiscoveryTopics } : {}), ...(autonomousInterval ? { minIntervalMs: autonomousInterval * 7 } : {}) })],
    ];
    for (const [key, enabled, work] of autonomous) {
      signal.throwIfAborted();
      if (!enabled) continue;
      try {
        result[key] = await work();
        log({ event: `${key}_discovery`, result: result[key] });
      } catch (error) {
        result[key] = { status: "failed", error: error instanceof Error ? error.message : String(error) };
        log({ event: `${key}_discovery_failed`, error: String(error) });
      }
    }
  }

  return result;
}

/** Discovery cannot hold up crawl replenishment, publication or maintenance. */
export async function runDiscoveryLoop(work: () => Promise<unknown>, signal: AbortSignal,
  onError: (error: unknown) => void, wait = (signal: AbortSignal) => delay(60_000, undefined, { signal })) {
  while (!signal.aborted) {
    try { await work(); } catch (error) { if (!signal.aborted) onError(error); }
    if (signal.aborted) break;
    try { await wait(signal); } catch (error) { if (!signal.aborted) throw error; }
  }
}
