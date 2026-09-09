import { catalogTypesForSource, promoteCatalogTypes, FULL_CATALOG_INTERVAL_MS, GOODS_TYPES } from './catalog-scope.js';
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { platformRetryAt, isWafChallengeError, mentionsWafChallenge, type CollectorRegistry } from "@price-radar/collector-sdk";
import {
  crawlRuns,
  rawOfferSnapshots,
  sources,
  type Database,
} from "@price-radar/database";
import { sourceIdentitySchema, type CatalogPage, type RawOfferInput } from "@price-radar/schema";
import { nextFailedRun, nextHealthyRun, nextWafBlockedRun } from "./source-health.js";
import { detectSemanticDuplicatesForRun } from "./quality.js";

export interface CrawlSourceOptions {
  now?: Date;
  maxPages?: number;
  successIntervalMs?: number;
  signal?: AbortSignal;
  allowDisabled?: boolean;
  promoteSource?: boolean;
  rawObjectStore?: RawObjectStore;
}

export interface RawObjectStore {
  putJson(key: string, value: unknown): Promise<{ uri: string; sha256: string; size: number }>;
}

export interface CrawlSourceResult {
  runId: string;
  status: "success" | "partial" | "failed";
  completeSnapshot: boolean;
  updatedSnapshot?: boolean;
  fetchedTotal: number;
  parsedTotal: number;
}

function transientCollectorError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:http_(?:429|5\d\d)|timeout|timed out|fetch failed|ECONNRESET|EAI_AGAIN|UND_ERR_CONNECT)/i.test(message);
}

async function withTransientRetry<T>(work: () => Promise<T>, signal: AbortSignal): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await work(); }
    catch (error) {
      last = error;
      if (attempt === 2 || !transientCollectorError(error) || signal.aborted) throw error;
      const delay = Math.round(250 * 2 ** attempt * (0.8 + Math.random() * 0.4));
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
      });
    }
  }
  throw last;
}

async function insertSnapshots(
  db: Database,
  runId: string,
  sourceId: string,
  offers: readonly RawOfferInput[],
  rawManifestUrl?: string,
  typeByItem?: ReadonlyMap<string,string>,
): Promise<void> {
  const rows = offers.map((offer) => ({
    crawlRunId: runId,
    sourceId,
    sourceItemId: offer.sourceItemId,
    ...(typeByItem?.get(offer.sourceItemId)?{goodsType:typeByItem.get(offer.sourceItemId)}:{}),
    rawTitle: offer.rawTitle,
    ...(offer.rawDescription ? { rawDescription: offer.rawDescription } : {}),
    ...(offer.rawCategory ? { rawCategory: offer.rawCategory } : {}),
    rawPriceText: offer.rawPriceText,
    rawPriceNumeric: offer.price,
    currency: offer.currency,
    ...(offer.rawStock !== undefined ? { rawStock: offer.rawStock } : {}),
    ...(offer.stockCount !== undefined ? { stockCount: offer.stockCount } : {}),
    stockStateHint: offer.stockState,
    productUrl: offer.productUrl,
    ...(offer.sourceUpdatedAt
      ? { sourceUpdatedAt: new Date(offer.sourceUpdatedAt) }
      : {}),
    capturedAt: new Date(offer.capturedAt),
    rawPayloadHash: offer.rawPayloadHash,
    ...(rawManifestUrl
      ? { rawPayloadUrl: `${rawManifestUrl}#item=${encodeURIComponent(offer.sourceItemId)}` }
      : {}),
  }));

  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    if (batch.length > 0) await db.insert(rawOfferSnapshots).values(batch);
  }
}

async function crawlSourceUnlocked(
  db: Database,
  registry: CollectorRegistry,
  sourceId: string,
  options: CrawlSourceOptions = {},
): Promise<CrawlSourceResult> {
  const startedAt = options.now ?? new Date();
  const maxPages = options.maxPages ?? 1_000;
  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(5 * 60_000)])
    : AbortSignal.timeout(5 * 60_000);
  const [source] = await db.select().from(sources).where(eq(sources.id, sourceId)).limit(1);
  if (!source) throw new Error(`source_not_found:${sourceId}`);
  if (!source.enabled && !options.allowDisabled) throw new Error(`source_disabled:${sourceId}`);

  const adapter = registry.get(source.collectorKind);
  if (!adapter) throw new Error(`collector_not_registered:${source.collectorKind}`);
  const [run] = await db
    .insert(crawlRuns)
    .values({
      sourceId,
      collectorKind: adapter.kind,
      collectorVersion: "0.1.0",
      status: "running",
      startedAt,
    })
    .returning({ id: crawlRuns.id });
  if (!run) throw new Error("crawl_run_insert_failed");

  try {
    const identity = sourceIdentitySchema.parse({
      platformKind: source.platformKind,
      platformMerchantId: source.platformMerchantId,
      canonicalEntryUrl: source.canonicalEntryUrl,
      ...(source.shopToken ? { shopToken: source.shopToken } : {}),
    });
    const typed=source.platformKind==='ldxp_shop_api';
    const requestedTypes=typed && source.enabled && options.promoteSource!==false && process.env.COLLECTOR_SCOPED_REFRESH==='true'
      ? await catalogTypesForSource(db,sourceId,source.lastSuccessAt,startedAt) : undefined;
    const fullCoverage=!requestedTypes||requestedTypes.length===GOODS_TYPES.length;
    const context = { sourceId, now: startedAt, signal, ...(requestedTypes?{catalogTypes:requestedTypes}:{}) };
    const typeByItem=new Map<string,string>();
    const pages: CatalogPage[] = [];
    const normalizedById = new Map<string, RawOfferInput>();
    let cursor: string | undefined;

    do {
      if (pages.length >= maxPages) throw new Error("catalog_page_limit_exceeded");
      const page = await withTransientRetry(() => adapter.fetchCatalog(identity, context, cursor), signal);
      pages.push(page);
      for (const item of page.items) {
        const normalized = adapter.normalizeItem(item, context);
        normalizedById.set(normalized.sourceItemId, normalized);
        if(typed&&page.goodsType)typeByItem.set(normalized.sourceItemId,page.goodsType);
      }
      cursor = page.nextCursor;
    } while (cursor);

    const validation = adapter.validateSnapshot(pages,context);
    const counts=new Map<string,number>();
    if(typed)for(const page of pages)if(page.goodsType)counts.set(page.goodsType,(counts.get(page.goodsType)??0)+page.items.length);
    const catalogScope=typed?{full:fullCoverage,types:[...counts].map(([type,count])=>({type,count}))}:undefined;
    const offers = [...normalizedById.values()];
    const storedManifest = options.rawObjectStore
      ? await options.rawObjectStore.putJson(
          `crawl-runs/${sourceId}/${run.id}.json`,
          {
            schemaVersion: 1,
            sourceId,
            runId: run.id,
            collectorKind: adapter.kind,
            collectorVersion: "0.1.0",
            capturedAt: startedAt.toISOString(),
            pageCount: pages.length,
            catalogScope,
            pages,
          },
        )
      : null;
    const finishedAt = new Date();
    const primaryError = validation.issues.find((issue) => issue.severity === "error");
    // Reserve time for the rest of the catalog: every source is due twice daily,
    // rather than repeatedly refreshing volatile shops while others wait.
    const adaptiveIntervalMs = options.successIntervalMs ?? 12 * 60 * 60_000;
    const health = validation.completeSnapshot
      ? nextHealthyRun(finishedAt, adaptiveIntervalMs)
      : nextFailedRun(finishedAt, source.consecutiveFailures);

    await db.transaction(async (tx) => {
      await insertSnapshots(tx, run.id, sourceId, offers, storedManifest?.uri,typeByItem);
      await tx
        .update(crawlRuns)
        .set({
          status: validation.status,
          completeSnapshot: validation.completeSnapshot && fullCoverage,
          ...(catalogScope?{catalogScope}:{}),
          expectedTotal: validation.expectedTotal,
          fetchedTotal: validation.fetchedTotal,
          parsedTotal: validation.parsedTotal,
          duplicateTotal: validation.duplicateTotal,
          finishedAt,
          ...(storedManifest
            ? {
                rawManifestUrl: storedManifest.uri,
                rawManifestHash: storedManifest.sha256,
              }
            : {}),
          ...(primaryError
            ? {
                errorCode: primaryError.code,
                errorMessage: validation.issues
                  .filter((issue) => issue.severity === "error")
                  .map((issue) => issue.message)
                  .join("; "),
              }
            : {}),
        })
        .where(and(eq(crawlRuns.id, run.id), eq(crawlRuns.sourceId, sourceId)));
      if (options.promoteSource !== false) {
        if(validation.completeSnapshot&&catalogScope)await promoteCatalogTypes(tx,sourceId,run.id);
        const nextRunAt=validation.completeSnapshot&&!fullCoverage&&source.lastSuccessAt
          ? new Date(Math.min(health.nextRunAt.getTime(),source.lastSuccessAt.getTime()+FULL_CATALOG_INTERVAL_MS)) : health.nextRunAt;
        await tx
          .update(sources)
          .set({
            ...health,
            nextRunAt,
            lastCheckedAt: finishedAt,
            ...(validation.completeSnapshot
              ? {
                  ...(fullCoverage?{lastSuccessAt: finishedAt,latestCompleteRunId:run.id,expectedProductCount:validation.expectedTotal}:{}),
                  lastErrorCode: null,
                }
              : { lastErrorCode: primaryError?.code ?? "partial_snapshot" }),
            updatedAt: finishedAt,
          })
          .where(eq(sources.id, sourceId));
      }
    });

    if (validation.completeSnapshot && fullCoverage) {
      // Duplicate scoring is advisory. A quality-side failure must never turn a
      // fully persisted source snapshot into a failed crawl or trigger backoff.
      await detectSemanticDuplicatesForRun(db, sourceId, run.id).catch(() => 0);
    }
    const finalStatus = validation.status === "success"
      ? "success"
      : validation.status === "partial"
        ? "partial"
        : "failed";
    return {
      runId: run.id,
      status: finalStatus,
      completeSnapshot: validation.completeSnapshot && fullCoverage,
      updatedSnapshot: validation.completeSnapshot,
      fetchedTotal: validation.fetchedTotal,
      parsedTotal: validation.parsedTotal,
    };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "unknown_crawl_failure";
    // A WAF challenge is an egress-reachability problem, not a source failure:
    // park the source on a long, non-escalating retry so it stays dormant and
    // self-heals instead of climbing into `failing`.
    const wafBlocked = isWafChallengeError(error) || mentionsWafChallenge(message);
    const deferredUntil = platformRetryAt(message);
    const health = deferredUntil
      ? { healthStatus: "retrying" as const, consecutiveFailures: source.consecutiveFailures, nextRunAt: deferredUntil }
      : wafBlocked
      ? nextWafBlockedRun(finishedAt, source.consecutiveFailures)
      : nextFailedRun(finishedAt, source.consecutiveFailures);
    const errorCode = deferredUntil ? "platform_deferred" : wafBlocked ? "waf_challenge" : "crawl_failed";
    await db.transaction(async (tx) => {
      await tx
        .update(crawlRuns)
        .set({ status: "failed", finishedAt, errorCode, errorMessage: message })
        .where(eq(crawlRuns.id, run.id));
      if (options.promoteSource !== false) {
        await tx
          .update(sources)
          .set({
            ...health,
            lastCheckedAt: finishedAt,
            lastErrorCode: errorCode,
            updatedAt: finishedAt,
          })
          .where(eq(sources.id, sourceId));
      }
    });
    throw error;
  }
}

export async function crawlSource(
  db: Database,
  registry: CollectorRegistry,
  sourceId: string,
  options: CrawlSourceOptions = {},
): Promise<CrawlSourceResult> {
  const [source] = await db.select({ canonicalEntryUrl: sources.canonicalEntryUrl, platformKind: sources.platformKind }).from(sources).where(eq(sources.id, sourceId)).limit(1);
  if (!source) throw new Error(`source_not_found:${sourceId}`);
  const hostname = new URL(source.canonicalEntryUrl).hostname.toLowerCase();
  const leaseToken = randomUUID();
  await db.execute(sql`delete from crawl_leases where expires_at<=now()`);
  let acquired = false;
  for (let platformSlot = 0; platformSlot < 4 && !acquired; platformSlot += 1) {
    const result = await db.execute(sql`
      insert into crawl_leases(source_id,hostname,platform_kind,platform_slot,lease_token,expires_at)
      values(${sourceId}::uuid,${hostname},${source.platformKind},${platformSlot},${leaseToken}::uuid,now()+interval '30 minutes')
      on conflict do nothing returning lease_token
    `);
    acquired = result.rows.length > 0;
  }
  if (!acquired) throw new Error("crawl_already_running_or_host_busy");
  try {
    return await crawlSourceUnlocked(db, registry, sourceId, options);
  } finally {
    await db.execute(sql`delete from crawl_leases where source_id=${sourceId}::uuid and lease_token=${leaseToken}::uuid`);
  }
}
