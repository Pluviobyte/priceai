import { runDiscoveryPass } from "./discovery-scheduler.js";
import { runContinuousChannelWork } from './continuous-channel.js';
import pg from "pg";
import { createDatabase } from "@price-radar/database";
import { PlatformTaskPool, IncrementalPublisher } from "./channel-execution.js";
import type { CollectorRegistry } from "@price-radar/collector-sdk";
import type { Database } from "@price-radar/database";
import {
  crawlSource,
  platformKeyForUrl,
  measureCatalogGrowth,
  recoverGrowthCandidates,
  evaluatePriceAlerts,
  findDueSources,
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
 * One channel cycle = discovery (when due) → entry URL repair → parallel
 * refresh/admission lanes with incremental publication → quality profiles. It needs only
 * PostgreSQL, so the same code runs from the long-lived channel worker, from
 * the CLI, and from a Dokploy schedule. A PostgreSQL advisory lock keeps the
 * cycle single-flight across containers.
 */
export const CHANNEL_CYCLE_LOCK = 7410319;

export interface ChannelCycleOptions {
  continuous?: boolean;
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
  crawledLinks?: unknown;
  telegram?: unknown;
  github?: unknown;
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

  if (!options.continuous || options.skipCrawl) Object.assign(result, await runDiscoveryPass(db, config, options));

  result.repair = await repairShopApiEntryUrls(db, registry, { limit: 10, signal });
  if (result.repair.repaired > 0) log({ event: "entry_urls_repaired", ...result.repair });

  if(options.continuous && !options.skipCrawl) return runContinuousChannelWork(db,registry,config,options);

  let published = false;
  const pool = new PlatformTaskPool(config.channelPlatformConcurrency, signal);
  const publisher = new IncrementalPublisher(async () => {
    const started = Date.now();
    await seedCanonicalProducts(db);
    const publication = await publishLatestSnapshots(db);
    let publicSnapshot: unknown = null;
    if (options.rawObjectStore && !publication.unchanged) {
      try { publicSnapshot = await storePublicGenerationSnapshot(db, options.rawObjectStore, publication.generationId); }
      catch (error) { publicSnapshot = { error: String(error) }; }
    }
    result.publication = { ...publication, publicSnapshot };
    published = true;
    log({ event: publication.unchanged ? "channels_refreshed" : "channels_published", generationId: publication.generationId, durationMs: Date.now() - started });
    // Alert delivery failure must not invalidate an already committed generation.
    try { await evaluatePriceAlerts(db, publication.generationId); }
    catch (error) { log({event: "price_alert_evaluation_failed", error: String(error)}); }
  }, error => log({event: "incremental_publication_failed", error: String(error)}));

  const crawlWork = async () => {
    if (options.skipCrawl) return;
    const due = (await findDueSources(db, new Date(), config.channelCrawlBatch)).filter(source => source.collectorKind !== "browser");
    const crawl = { attempted: 0, complete: 0, failed: 0 };
    result.crawl = crawl;
    const outcomes = await Promise.allSettled(due.map(source => pool.run(platformKeyForUrl(source.canonicalEntryUrl), async () => {
      if (signal.aborted) return;
      const started = Date.now();
      crawl.attempted++;
      try {
        const outcome = await crawlSource(db, registry, source.id, {signal, ...(options.rawObjectStore ? {rawObjectStore: options.rawObjectStore} : {})});
        if ((outcome.completeSnapshot||outcome.updatedSnapshot) && outcome.status === "success") { if(outcome.completeSnapshot)crawl.complete++; publisher.changed(); }
        else crawl.failed++;
        log({event: "source_crawled", sourceId: source.id, durationMs: Date.now() - started, ...outcome});
      } catch (error) {
        crawl.failed++;
        log({event: "source_crawl_failed", sourceId: source.id, durationMs: Date.now() - started, error: String(error)});
      }
    })));
    const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
    if (failure) throw failure.reason;
  };
  const vetWork = async () => {
    if (!config.sourceDiscoveryEnabled || options.skipVetting) return;
    if (process.env.COLLECTOR_GROWTH_RECOVERY === 'true') {
      const recovery = await recoverGrowthCandidates(db, 100);
      if (recovery.requeued) log({event:'growth_candidates_requeued',...recovery});
    }
    const batch = await vetNextCandidates(db, registry, {
      limit: config.candidateVettingBatch, signal,
      ...(options.rawObjectStore ? {rawObjectStore: options.rawObjectStore} : {}),
      execute: (key, work) => pool.run(key, work),
      onResult: item => {
        log({event: "candidate_vetted", ...item, profile: undefined});
        if (item.status === 'approved' && !options.skipCrawl) publisher.changed();
      },
    });
    const {results, ...counts} = batch;
    result.vetting = counts;
  };
  // Both lanes share the same platform pool. Wait for every task before closing
  // the publisher or releasing the cycle lock, including on errors/termination.
  const outcomes = await Promise.allSettled([crawlWork(), vetWork()]);
  await publisher.flush();
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure) throw failure.reason;

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
  let database: ReturnType<typeof createDatabase> | undefined;
  try {
    locked = (await client.query("select pg_try_advisory_lock($1) as acquired", [CHANNEL_CYCLE_LOCK])).rows[0].acquired as boolean;
    if (!locked) return { status: "skipped", reason: "already_running", durationMs: Date.now() - startedAt };
    const ready = (await client.query("select exists(select 1 from information_schema.columns where table_name='source_candidates' and column_name='vetting_result') as ready")).rows[0].ready as boolean;
    if (!ready) return { status: "skipped", reason: "migration_0018_pending", durationMs: Date.now() - startedAt };
    const policyReady = (await client.query("select to_regclass('collector_platform_state') is not null as ready")).rows[0].ready as boolean;
    if (!policyReady) return { status: "skipped", reason: "migration_0020_pending", durationMs: Date.now() - startedAt };
    const scopesReady = (await client.query("select to_regclass('source_catalog_type_snapshots') is not null and exists(select 1 from information_schema.columns where table_name='collector_platform_state' and column_name='cooldown_level') as ready")).rows[0].ready as boolean;
    if (!scopesReady) return { status: "skipped", reason: "migration_0022_pending", durationMs: Date.now() - startedAt };
    // Parallel transactions require separate pool connections. The session-level
    // cycle lock above stays on its dedicated client until every task settles.
    database = createDatabase(config.databaseUrl);
    const result = await runChannelCycleWith(database.db, registry, config, options);
    const durationMs = Date.now() - startedAt;
    const worked = (result.vetting?.attempted ?? 0) > 0 || (result.crawl?.attempted ?? 0) > 0 || Array.isArray(result.discovery) && result.discovery.some((item) => (item as { status?: string }).status === "success");
    await client.query(
      "insert into system_metric_samples(service,metric,value,unit,labels) values('channel-worker','channel_cycle_duration',$1,'milliseconds',$2::jsonb)",
      [String(durationMs), JSON.stringify({ worked, vetted: result.vetting?.attempted ?? 0, crawled: result.crawl?.attempted ?? 0 })],
    ).catch(() => undefined);
    return { status: "success", ...result, durationMs };
  } finally {
    await database?.close();
    if (locked) await client.query("select pg_advisory_unlock($1)", [CHANNEL_CYCLE_LOCK]).catch(() => undefined);
    await client.end();
  }
}
