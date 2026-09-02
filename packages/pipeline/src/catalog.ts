import { and, eq } from "drizzle-orm";
import type { CollectorRegistry } from "@price-radar/collector-sdk";
import {
  crawlRuns,
  rawOfferSnapshots,
  sources,
  type Database,
} from "@price-radar/database";
import { sourceIdentitySchema, type CatalogPage, type RawOfferInput } from "@price-radar/schema";
import { nextFailedRun, nextHealthyRun } from "./source-health.js";

export interface CrawlSourceOptions {
  now?: Date;
  maxPages?: number;
  successIntervalMs?: number;
  signal?: AbortSignal;
  allowDisabled?: boolean;
  promoteSource?: boolean;
}

export interface CrawlSourceResult {
  runId: string;
  status: "success" | "partial" | "failed";
  completeSnapshot: boolean;
  fetchedTotal: number;
  parsedTotal: number;
}

async function insertSnapshots(
  db: Database,
  runId: string,
  sourceId: string,
  offers: readonly RawOfferInput[],
): Promise<void> {
  const rows = offers.map((offer) => ({
    crawlRunId: runId,
    sourceId,
    sourceItemId: offer.sourceItemId,
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
  }));

  for (let offset = 0; offset < rows.length; offset += 250) {
    const batch = rows.slice(offset, offset + 250);
    if (batch.length > 0) await db.insert(rawOfferSnapshots).values(batch);
  }
}

export async function crawlSource(
  db: Database,
  registry: CollectorRegistry,
  sourceId: string,
  options: CrawlSourceOptions = {},
): Promise<CrawlSourceResult> {
  const startedAt = options.now ?? new Date();
  const maxPages = options.maxPages ?? 1_000;
  const signal = options.signal ?? new AbortController().signal;
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
    const context = { sourceId, now: startedAt, signal };
    const pages: CatalogPage[] = [];
    const normalizedById = new Map<string, RawOfferInput>();
    let cursor: string | undefined;

    do {
      if (pages.length >= maxPages) throw new Error("catalog_page_limit_exceeded");
      const page = await adapter.fetchCatalog(identity, context, cursor);
      pages.push(page);
      for (const item of page.items) {
        const normalized = adapter.normalizeItem(item, context);
        normalizedById.set(normalized.sourceItemId, normalized);
      }
      cursor = page.nextCursor;
    } while (cursor);

    const validation = adapter.validateSnapshot(pages);
    const offers = [...normalizedById.values()];
    const finishedAt = new Date();
    const primaryError = validation.issues.find((issue) => issue.severity === "error");
    const health = validation.completeSnapshot
      ? nextHealthyRun(finishedAt, options.successIntervalMs)
      : nextFailedRun(finishedAt, source.consecutiveFailures);

    await db.transaction(async (tx) => {
      await insertSnapshots(tx, run.id, sourceId, offers);
      await tx
        .update(crawlRuns)
        .set({
          status: validation.status,
          completeSnapshot: validation.completeSnapshot,
          expectedTotal: validation.expectedTotal,
          fetchedTotal: validation.fetchedTotal,
          parsedTotal: validation.parsedTotal,
          duplicateTotal: validation.duplicateTotal,
          finishedAt,
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
        await tx
          .update(sources)
          .set({
            ...health,
            lastCheckedAt: finishedAt,
            ...(validation.completeSnapshot
              ? {
                  lastSuccessAt: finishedAt,
                  latestCompleteRunId: run.id,
                  expectedProductCount: validation.expectedTotal,
                  lastErrorCode: null,
                }
              : { lastErrorCode: primaryError?.code ?? "partial_snapshot" }),
            updatedAt: finishedAt,
          })
          .where(eq(sources.id, sourceId));
      }
    });

    const finalStatus = validation.status === "success"
      ? "success"
      : validation.status === "partial"
        ? "partial"
        : "failed";
    return {
      runId: run.id,
      status: finalStatus,
      completeSnapshot: validation.completeSnapshot,
      fetchedTotal: validation.fetchedTotal,
      parsedTotal: validation.parsedTotal,
    };
  } catch (error) {
    const finishedAt = new Date();
    const message = error instanceof Error ? error.message : "unknown_crawl_failure";
    const health = nextFailedRun(finishedAt, source.consecutiveFailures);
    await db.transaction(async (tx) => {
      await tx
        .update(crawlRuns)
        .set({ status: "failed", finishedAt, errorCode: "crawl_failed", errorMessage: message })
        .where(eq(crawlRuns.id, run.id));
      if (options.promoteSource !== false) {
        await tx
          .update(sources)
          .set({
            ...health,
            lastCheckedAt: finishedAt,
            lastErrorCode: "crawl_failed",
            updatedAt: finishedAt,
          })
          .where(eq(sources.id, sourceId));
      }
    });
    throw error;
  }
}
