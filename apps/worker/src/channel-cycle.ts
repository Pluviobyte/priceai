import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@price-radar/database/schema";
import type { CollectorRegistry } from "@price-radar/collector-sdk";
import type { Database } from "@price-radar/database";
import {
  crawlSource,
  measureCatalogGrowth,
  recoverGrowthCandidates,
  enumerate16688SourceMarketplace,
  evaluatePriceAlerts,
  findDueSources,
  importSourceDirectories,
  publishLatestSnapshots,
  refreshSourceQualityProfiles,
  repairShopApiEntryUrls,
  seedCanonicalProducts,
  storePublicGenerationSnapshot,
  vetNextCandidates,
  type RawObjectStore,
} from "@price-radar/pipeline";
import type { WorkerConfig } from "./config.js";

/**
 * One channel cycle = discovery (when due) → entry URL repair → candidate
 * vetting → due-source crawls → publish → quality profiles. It needs only
 * PostgreSQL, so the same code runs from the long-lived channel worker, from
 * the CLI, and from a Dokploy schedule. A PostgreSQL advisory lock keeps the
 * cycle single-flight across containers.
 */
export const CHANNEL_CYCLE_LOCK = 7410319;

export interface ChannelCycleOptions {
  signal?: AbortSignal;
  rawObjectStore?: RawObjectStore;
  /** Force the directory import even when the last one is recent. */
  forceDiscovery?: boolean;
  skipDiscovery?: boolean;
  skipVetting?: boolean;
  skipCrawl?: boolean;
  log?: (event: Record<string, unknown>) => void;
}

export interface ChannelCycleResult {
  status: "success" | "skipped";
  reason?: string;
  discovery?: unknown;
  marketplace?: unknown;
  repair?: { checked: number; repaired: number };
  vetting?: { attempted: number; approved: number; review: number; rejected: number; duplicate: number; adapterNeeded: number; deferred: number };
  crawl?: { attempted: number; complete: number; failed: number };
  publication?: unknown;
  profiles?: { refreshed: number; degraded: number };
  durationMs: number;
}

export async function runChannelCycleWith(db: Database, registry: CollectorRegistry, config: WorkerConfig, options: ChannelCycleOptions = {}): Promise<Omit<ChannelCycleResult, "status" | "durationMs">> {
  const signal = options.signal ?? new AbortController().signal;
  const log = options.log ?? (() => undefined);
  const result: Omit<ChannelCycleResult, "status" | "durationMs"> = {};

  if (config.sourceDiscoveryEnabled && !options.skipDiscovery) {
    const minIntervalMs = options.forceDiscovery ? undefined : config.sourceDirectoryImportIntervalMs;
    result.discovery = await importSourceDirectories(db, { signal, ...(minIntervalMs ? { minIntervalMs } : {}) });
    log({ event: "directory_import", result: result.discovery });
    try {
      result.marketplace = await enumerate16688SourceMarketplace(db, { signal, ...(minIntervalMs ? { minIntervalMs } : {}) });
      log({ event: "marketplace_enumeration", result: result.marketplace });
    } catch (error) {
      result.marketplace = { status: "failed", error: error instanceof Error ? error.message : String(error) };
      log({ event: "marketplace_enumeration_failed", error: String(error) });
    }
  }

  result.repair = await repairShopApiEntryUrls(db, registry, { limit: 10, signal });
  if (result.repair.repaired > 0) log({ event: "entry_urls_repaired", ...result.repair });

  if (config.sourceDiscoveryEnabled && !options.skipVetting) {
    if (process.env.COLLECTOR_GROWTH_RECOVERY === 'true') {
      const recovery = await recoverGrowthCandidates(db, 30);
      if (recovery.requeued) log({event:'growth_candidates_requeued',...recovery});
    }
    const batch = await vetNextCandidates(db, registry, { limit: config.candidateVettingBatch, signal, ...(options.rawObjectStore ? { rawObjectStore: options.rawObjectStore } : {}) });
    const { results, ...counts } = batch;
    result.vetting = counts;
    for (const item of results) log({ event: "candidate_vetted", ...item, profile: undefined });
  }

  let published = false;
  if (!options.skipCrawl) {
    const due = (await findDueSources(db, new Date(), config.channelCrawlBatch)).filter((source) => source.collectorKind !== "browser");
    const crawl = { attempted: 0, complete: 0, failed: 0 };
    for (const source of due) {
      if (signal.aborted) break;
      crawl.attempted += 1;
      try {
        const outcome = await crawlSource(db, registry, source.id, { signal, ...(options.rawObjectStore ? { rawObjectStore: options.rawObjectStore } : {}) });
        if (outcome.completeSnapshot && outcome.status === "success") crawl.complete += 1;
        else crawl.failed += 1;
        log({ event: "source_crawled", sourceId: source.id, ...outcome });
      } catch (error) {
        crawl.failed += 1;
        log({ event: "source_crawl_failed", sourceId: source.id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    result.crawl = crawl;
    if (crawl.complete > 0 || (result.vetting?.approved ?? 0) > 0) {
      await seedCanonicalProducts(db);
      const publication = await publishLatestSnapshots(db);
      let publicSnapshot: unknown = null;
      if (options.rawObjectStore) {
        try { publicSnapshot = await storePublicGenerationSnapshot(db, options.rawObjectStore, publication.generationId); }
        catch (error) { publicSnapshot = { error: error instanceof Error ? error.message : String(error) }; }
      }
      const alerts = await evaluatePriceAlerts(db, publication.generationId);
      result.publication = { ...publication, publicSnapshot, alerts };
      published = true;
      log({ event: "channels_published", generationId: publication.generationId });
    }
  }

  result.profiles = await refreshSourceQualityProfiles(db, { limit: published ? 20 : 10, maxAgeMs: config.qualityProfileMaxAgeMs });
  const growth = await measureCatalogGrowth(db);
  log({event:'catalog_growth',...growth});
  await db.execute((await import('drizzle-orm')).sql`insert into system_metric_samples(service,metric,value,unit,labels)
    values('channel-worker','catalog_valid_offers',${String(growth?.valid_offers ?? 0)},'offers',${JSON.stringify(growth)}::jsonb)`);
  return result;
}

/** Acquires the cross-process lock, runs one cycle, records it, releases the lock. */
export async function runChannelCycle(registry: CollectorRegistry, config: WorkerConfig, options: ChannelCycleOptions = {}): Promise<ChannelCycleResult> {
  const startedAt = Date.now();
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  let locked = false;
  try {
    locked = (await client.query("select pg_try_advisory_lock($1) as acquired", [CHANNEL_CYCLE_LOCK])).rows[0].acquired as boolean;
    if (!locked) return { status: "skipped", reason: "already_running", durationMs: Date.now() - startedAt };
    const ready = (await client.query("select exists(select 1 from information_schema.columns where table_name='source_candidates' and column_name='vetting_result') as ready")).rows[0].ready as boolean;
    if (!ready) return { status: "skipped", reason: "migration_0018_pending", durationMs: Date.now() - startedAt };
    const policyReady = (await client.query("select to_regclass('collector_platform_state') is not null as ready")).rows[0].ready as boolean;
    if (!policyReady) return { status: "skipped", reason: "migration_0020_pending", durationMs: Date.now() - startedAt };
    const db = drizzle(client, { schema });
    const result = await runChannelCycleWith(db, registry, config, options);
    const durationMs = Date.now() - startedAt;
    const worked = (result.vetting?.attempted ?? 0) > 0 || (result.crawl?.attempted ?? 0) > 0 || Array.isArray(result.discovery) && result.discovery.some((item) => (item as { status?: string }).status === "success");
    await client.query(
      "insert into system_metric_samples(service,metric,value,unit,labels) values('channel-worker','channel_cycle_duration',$1,'milliseconds',$2::jsonb)",
      [String(durationMs), JSON.stringify({ worked, vetted: result.vetting?.attempted ?? 0, crawled: result.crawl?.attempted ?? 0 })],
    ).catch(() => undefined);
    return { status: "success", ...result, durationMs };
  } finally {
    if (locked) await client.query("select pg_advisory_unlock($1)", [CHANNEL_CYCLE_LOCK]).catch(() => undefined);
    await client.end();
  }
}
