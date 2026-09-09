import { promoteApprovedTrial } from './trial-promotion.js';
import { and, desc, eq, inArray, isNotNull, lt, ne, or, sql } from "drizzle-orm";
import { classifyOffer } from "@price-radar/classifier";
import { platformRetryAt, mentionsWafChallenge, type CollectorRegistry } from "@price-radar/collector-sdk";
import {
  auditLogs,
  canonicalProducts,
  crawlRuns,
  merchants,
  offers,
  rawOfferSnapshots,
  sourceCandidates,
  sourceQualityProfiles,
  sources,
  sourceSubmissions,
  type Database,
} from "@price-radar/database";
import type { RawOfferInput, SourceIdentity } from "@price-radar/schema";
import { familyForHost } from "@price-radar/source-signatures";
import type { RawObjectStore } from "./catalog.js";
import { findVettableCandidates } from "./scheduler.js";
import { platformKey, platformKeySql, platformAvailableSql } from "./platform-policy.js";
import { jaccard, tokens } from "./quality.js";
import { precheckSourceSubmission } from "./submissions.js";
import { assertSafePublicUrl } from "./url-security.js";

/**
 * Merchant vetting: turns a discovered shop URL into an enabled source only
 * after the shop passed the same gates a human reviewer applies — safe URL,
 * supported storefront, resolved identity, complete trial crawl, a catalog that
 * actually sells AI products, and no sign of being a mirror of a shop we already
 * track. Every decision keeps its evidence on the candidate and in the audit log.
 */
export const VETTING_VERSION = "vetting-2026-09-09.1";
/** WAF-blocked candidates are re-probed after this long; they leave the human queue meanwhile. */
export const EGRESS_BLOCK_RETRY_MS = 24 * 60 * 60_000;
export const AUTOMATIC_ACTOR = "automatic_vetting";

export interface SourceQualityProfile {
  itemCount: number;
  aiRelevantCount: number;
  aiConfidentCount: number;
  aiRelevantShare: number;
  inStockCount: number;
  outOfStockShare: number;
  noWarrantyShare: number;
  riskFactCount: number;
  contactPresent: boolean;
  priceOutlierShare: number | null;
  priceComparableCount: number;
  catalogOverlapMax: number | null;
  catalogOverlapSourceId: string | null;
  merchantCreatedAt: string | null;
  products: Record<string, number>;
}

export interface OtherCatalog {
  sourceId: string;
  titleTokens: Set<string>[];
}

export interface ProfileContext {
  /** Current purchasable CNY prices per canonical product slug. */
  comparables: Map<string, number[]>;
  otherCatalogs: OtherCatalog[];
  merchantCreatedAt?: string;
  contact?: Record<string, string>;
}

export type VettingVerdict = "approved" | "review" | "rejected";

export interface VettingDecision {
  verdict: VettingVerdict;
  reasons: string[];
  retryAfterDays?: number;
}

export interface VettingThresholds {
  minRelevantItems: number;
  minRelevantShare: number;
  mirrorOverlap: number;
  outlierPriceRatio: number;
  outlierShare: number;
  minComparables: number;
  retryDays: number;
}

export const DEFAULT_THRESHOLDS: VettingThresholds = {
  minRelevantItems: 3,
  minRelevantShare: 0.3,
  mirrorOverlap: 0.9,
  outlierPriceRatio: 0.4,
  outlierShare: 0.5,
  minComparables: 3,
  retryDays: 30,
};

const CONTACT_PATTERN = /(?:qq|q群|tg|telegram|电报|微信|wx|vx|飞机|whatsapp)\s*[:：号群]?\s*[@]?[A-Za-z0-9_+-]{4,}|t\.me\/[A-Za-z0-9_+-]+/i;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[middle] ?? null) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function ratio(part: number, whole: number): number {
  return whole > 0 ? Number((part / whole).toFixed(4)) : 0;
}

/** Pure profile computation over one complete catalog snapshot. */
export function buildSourceQualityProfile(items: readonly RawOfferInput[], context: ProfileContext): SourceQualityProfile {
  const products: Record<string, number> = {};
  let aiRelevantCount = 0;
  let aiConfidentCount = 0;
  let inStockCount = 0;
  let outOfStockCount = 0;
  let noWarrantyCount = 0;
  let riskFactCount = 0;
  let contactPresent = Boolean(context.contact && Object.keys(context.contact).length > 0);
  let compared = 0;
  let outliers = 0;
  const titleTokens: Set<string>[] = [];

  for (const item of items) {
    const classification = classifyOffer(item);
    const slug = classification.canonicalProductSlug;
    if (slug) {
      aiRelevantCount += 1;
      products[slug] = (products[slug] ?? 0) + 1;
      if (classification.confidence >= 0.7) aiConfidentCount += 1;
      const comparable = context.comparables.get(slug);
      const price = Number(item.price);
      if (comparable && comparable.length >= 5 && Number.isFinite(price) && price > 0 && item.currency === "CNY") {
        const reference = median(comparable);
        if (reference && reference > 0) {
          compared += 1;
          if (price < reference * DEFAULT_THRESHOLDS.outlierPriceRatio) outliers += 1;
        }
      }
    }
    if (item.stockState === "in_stock" || item.stockState === "low_stock") inStockCount += 1;
    if (item.stockState === "out_of_stock") outOfStockCount += 1;
    const facts = classification.attributes.riskFacts;
    riskFactCount += facts.length;
    if (classification.attributes.warrantyType === "none" || facts.some((fact) => /无质保|无售后|不质保/.test(fact))) noWarrantyCount += 1;
    if (!contactPresent && CONTACT_PATTERN.test(`${item.rawTitle} ${item.rawDescription ?? ""}`)) contactPresent = true;
    titleTokens.push(tokens(item.rawTitle));
  }

  let catalogOverlapMax: number | null = null;
  let catalogOverlapSourceId: string | null = null;
  if (titleTokens.length >= 3) {
    for (const other of context.otherCatalogs) {
      if (other.titleTokens.length === 0) continue;
      let matched = 0;
      for (const title of titleTokens) {
        if (other.titleTokens.some((candidate) => jaccard(title, candidate) >= 0.85)) matched += 1;
      }
      const share = matched / titleTokens.length;
      if (catalogOverlapMax === null || share > catalogOverlapMax) {
        catalogOverlapMax = Number(share.toFixed(4));
        catalogOverlapSourceId = other.sourceId;
      }
    }
  }

  return {
    itemCount: items.length,
    aiRelevantCount,
    aiConfidentCount,
    aiRelevantShare: ratio(aiRelevantCount, items.length),
    inStockCount,
    outOfStockShare: ratio(outOfStockCount, items.length),
    noWarrantyShare: ratio(noWarrantyCount, items.length),
    riskFactCount,
    contactPresent,
    priceOutlierShare: compared > 0 ? ratio(outliers, compared) : null,
    priceComparableCount: compared,
    catalogOverlapMax,
    catalogOverlapSourceId,
    merchantCreatedAt: context.merchantCreatedAt ?? null,
    products,
  };
}

/** Pure verdict rules. Anything not clearly good or clearly irrelevant goes to a human. */
export function decideVetting(
  profile: SourceQualityProfile,
  trial: { complete: boolean; status: string },
  thresholds: VettingThresholds = DEFAULT_THRESHOLDS,
): VettingDecision {
  const reasons: string[] = [];
  if (!trial.complete) {
    return { verdict: "review", reasons: [`trial_incomplete:${trial.status}`] };
  }
  if (profile.itemCount === 0) {
    return { verdict: "rejected", reasons: ["empty_catalog"], retryAfterDays: thresholds.retryDays };
  }
  if (profile.aiRelevantCount === 0) {
    return { verdict: "rejected", reasons: ["no_ai_relevant_items"], retryAfterDays: thresholds.retryDays };
  }
  if (profile.catalogOverlapMax !== null && profile.catalogOverlapMax >= thresholds.mirrorOverlap && profile.catalogOverlapSourceId) {
    reasons.push(`catalog_mirror_suspected:${profile.catalogOverlapSourceId}`);
  }
  if (profile.priceComparableCount >= thresholds.minComparables && (profile.priceOutlierShare ?? 0) >= thresholds.outlierShare) {
    reasons.push("prices_far_below_market");
  }
  if (reasons.length > 0) return { verdict: "review", reasons };
  if (profile.aiConfidentCount === 0) return { verdict: "review", reasons: ["no_confident_ai_matches"] };
  if (profile.aiConfidentCount >= thresholds.minRelevantItems || profile.aiConfidentCount / profile.itemCount >= thresholds.minRelevantShare) {
    return { verdict: "approved", reasons: [`ai_relevant_items:${profile.aiRelevantCount}`, `ai_relevant_share:${profile.aiRelevantShare}`] };
  }
  return { verdict: "review", reasons: [`low_ai_relevance:${profile.aiRelevantCount}/${profile.itemCount}`] };
}

interface SnapshotRow {
  sourceItemId: string;
  rawTitle: string;
  rawDescription: string | null;
  rawCategory: string | null;
  rawPriceText: string;
  rawPriceNumeric: string | null;
  currency: string;
  rawStock: unknown;
  stockCount: number | null;
  stockStateHint: RawOfferInput["stockState"];
  productUrl: string;
  sourceUpdatedAt: Date | null;
  capturedAt: Date;
  rawPayloadHash: string;
}

function toRawOffer(row: SnapshotRow): RawOfferInput {
  const numeric = row.rawPriceNumeric !== null ? Number(row.rawPriceNumeric) : Number.NaN;
  return {
    sourceItemId: row.sourceItemId,
    rawTitle: row.rawTitle,
    ...(row.rawDescription ? { rawDescription: row.rawDescription } : {}),
    ...(row.rawCategory ? { rawCategory: row.rawCategory } : {}),
    rawPriceText: row.rawPriceText,
    price: Number.isFinite(numeric) && numeric >= 0 ? String(numeric) : "0",
    currency: row.currency,
    ...(row.rawStock !== null && row.rawStock !== undefined ? { rawStock: row.rawStock } : {}),
    ...(row.stockCount !== null ? { stockCount: row.stockCount } : {}),
    stockState: row.stockStateHint,
    productUrl: row.productUrl,
    ...(row.sourceUpdatedAt ? { sourceUpdatedAt: row.sourceUpdatedAt.toISOString() } : {}),
    capturedAt: row.capturedAt.toISOString(),
    rawPayloadHash: row.rawPayloadHash,
  };
}

async function loadRunItems(db: Database, runId: string): Promise<RawOfferInput[]> {
  const rows = await db.select({
    sourceItemId: rawOfferSnapshots.sourceItemId,
    rawTitle: rawOfferSnapshots.rawTitle,
    rawDescription: rawOfferSnapshots.rawDescription,
    rawCategory: rawOfferSnapshots.rawCategory,
    rawPriceText: rawOfferSnapshots.rawPriceText,
    rawPriceNumeric: rawOfferSnapshots.rawPriceNumeric,
    currency: rawOfferSnapshots.currency,
    rawStock: rawOfferSnapshots.rawStock,
    stockCount: rawOfferSnapshots.stockCount,
    stockStateHint: rawOfferSnapshots.stockStateHint,
    productUrl: rawOfferSnapshots.productUrl,
    sourceUpdatedAt: rawOfferSnapshots.sourceUpdatedAt,
    capturedAt: rawOfferSnapshots.capturedAt,
    rawPayloadHash: rawOfferSnapshots.rawPayloadHash,
  }).from(rawOfferSnapshots).where(eq(rawOfferSnapshots.crawlRunId, runId)).limit(5_000);
  return rows.map(toRawOffer);
}

/** Market context shared by one vetting batch: current prices and every enabled catalog. */
export async function loadProfileContext(db: Database, options: { excludeSourceId?: string; maxCatalogs?: number } = {}): Promise<Pick<ProfileContext, "comparables" | "otherCatalogs">> {
  const priceRows = await db.select({ slug: canonicalProducts.slug, price: offers.price, currency: offers.currency })
    .from(offers)
    .innerJoin(canonicalProducts, eq(offers.canonicalProductId, canonicalProducts.id))
    .where(and(eq(offers.availabilityState, "purchasable"), eq(offers.currency, "CNY")))
    .limit(20_000);
  const comparables = new Map<string, number[]>();
  for (const row of priceRows) {
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const list = comparables.get(row.slug) ?? [];
    list.push(price);
    comparables.set(row.slug, list);
  }
  const catalogSources = await db.select({ id: sources.id, runId: sources.latestCompleteRunId })
    .from(sources)
    .where(and(eq(sources.enabled, true), isNotNull(sources.latestCompleteRunId), ...(options.excludeSourceId ? [ne(sources.id, options.excludeSourceId)] : [])))
    .orderBy(desc(sources.lastSuccessAt))
    .limit(options.maxCatalogs ?? 400);
  const runIds = catalogSources.flatMap((row) => (row.runId ? [row.runId] : []));
  const otherCatalogs: OtherCatalog[] = [];
  if (runIds.length > 0) {
    const titles = await db.select({ sourceId: rawOfferSnapshots.sourceId, title: rawOfferSnapshots.rawTitle })
      .from(rawOfferSnapshots)
      .where(inArray(rawOfferSnapshots.crawlRunId, runIds))
      .limit(60_000);
    const bySource = new Map<string, Set<string>[]>();
    for (const row of titles) {
      const list = bySource.get(row.sourceId) ?? [];
      if (list.length < 400) list.push(tokens(row.title));
      bySource.set(row.sourceId, list);
    }
    for (const [sourceId, titleTokens] of bySource) otherCatalogs.push({ sourceId, titleTokens });
  }
  return { comparables, otherCatalogs };
}

async function upsertProfile(db: Database, sourceId: string, runId: string | null, profile: SourceQualityProfile, verdict: string, reasons: string[]): Promise<void> {
  const values = {
    sourceId,
    crawlRunId: runId,
    itemCount: profile.itemCount,
    aiRelevantCount: profile.aiRelevantCount,
    aiRelevantShare: profile.aiRelevantShare.toFixed(4),
    inStockCount: profile.inStockCount,
    outOfStockShare: profile.outOfStockShare.toFixed(4),
    noWarrantyShare: profile.noWarrantyShare.toFixed(4),
    riskFactCount: profile.riskFactCount,
    contactPresent: profile.contactPresent,
    priceOutlierShare: profile.priceOutlierShare === null ? null : profile.priceOutlierShare.toFixed(4),
    priceComparableCount: profile.priceComparableCount,
    catalogOverlapMax: profile.catalogOverlapMax === null ? null : profile.catalogOverlapMax.toFixed(4),
    catalogOverlapSourceId: profile.catalogOverlapSourceId,
    merchantCreatedAt: profile.merchantCreatedAt ? new Date(profile.merchantCreatedAt) : null,
    verdict,
    reasons,
    products: profile.products,
    profileVersion: VETTING_VERSION,
    computedAt: new Date(),
  };
  await db.insert(sourceQualityProfiles).values(values).onConflictDoUpdate({ target: sourceQualityProfiles.sourceId, set: values });
}

export interface VetCandidateOptions {
  signal?: AbortSignal;
  rawObjectStore?: RawObjectStore;
  thresholds?: VettingThresholds;
  context?: Pick<ProfileContext, "comparables" | "otherCatalogs">;
  now?: Date;
}

export interface VetCandidateResult {
  candidateId: string;
  status: "approved" | "review" | "rejected" | "duplicate" | "adapter_needed" | "deferred" | "skipped" | "blocked_egress";
  reasons: string[];
  sourceId?: string;
  submissionId?: string;
  trialRunId?: string;
  profile?: SourceQualityProfile;
}

interface CandidateRow {
  id: string;
  candidateUrl: string;
  merchantNameHint: string | null;
  discoveryEvidence: Array<{ provider: string; url: string | null; seenAt: string; nameHint?: string }>;
  vettingResult: Record<string, unknown> | null;
  sourceId: string | null;
  platformKind: string | null;
  platformMerchantId: string | null;
}

async function finishCandidate(db: Database, candidate: CandidateRow, patch: Partial<typeof sourceCandidates.$inferInsert>, action: string, reasons: string[], detail: Record<string, unknown>): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(sourceCandidates).set({ ...patch, vettedAt: new Date(), reviewedAt: new Date() }).where(eq(sourceCandidates.id, candidate.id));
    await tx.insert(auditLogs).values({
      actorId: AUTOMATIC_ACTOR,
      action: `source_candidate.${action}`,
      targetType: "source_candidate",
      targetId: candidate.id,
      reason: reasons.join("; ").slice(0, 500) || action,
      beforeValue: { status: "vetting", candidateUrl: candidate.candidateUrl, platformKind: candidate.platformKind, platformMerchantId: candidate.platformMerchantId },
      afterValue: { status: patch.status ?? null, ...detail },
    });
  });
}

function providersOf(candidate: CandidateRow): string[] {
  return [...new Set(candidate.discoveryEvidence.map((item) => item.provider))];
}

function wafBlocked(text: string | null | undefined): boolean {
  return mentionsWafChallenge(text) || /shop_api(?:_16688)?_access_challenge/.test(text ?? "");
}

async function existingSourceFor(db: Database, identity: SourceIdentity): Promise<{ id: string; enabled: boolean } | undefined> {
  const [row] = await db.select({ id: sources.id, enabled: sources.enabled }).from(sources)
    .where(and(eq(sources.platformKind, identity.platformKind), eq(sources.platformMerchantId, identity.platformMerchantId)))
    .limit(1);
  return row;
}

/**
 * Runs the whole vetting sequence for one pending candidate. Network failures
 * that are not the shop's fault (host busy, timeouts) defer the candidate; the
 * third such failure hands it to a human instead of looping forever.
 */
export async function vetCandidate(db: Database, registry: CollectorRegistry, candidateId: string, options: VetCandidateOptions = {}): Promise<VetCandidateResult> {
  const signal = options.signal ?? new AbortController().signal;
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const now = options.now ?? new Date();
  const claimed = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(7410320)`);
    return tx.update(sourceCandidates).set({ status: "vetting", vettedAt: now })
    .where(and(eq(sourceCandidates.id, candidateId), eq(sourceCandidates.status, "pending"), or(sql`${sourceCandidates.nextVetAt} is null`, sql`${sourceCandidates.nextVetAt} <= ${now}`)))
    .returning({
      id: sourceCandidates.id,
      sourceId: sourceCandidates.sourceId,
      candidateUrl: sourceCandidates.candidateUrl,
      merchantNameHint: sourceCandidates.merchantNameHint,
      discoveryEvidence: sourceCandidates.discoveryEvidence,
      vettingResult: sourceCandidates.vettingResult,
      platformKind: sourceCandidates.platformKind,
      platformMerchantId: sourceCandidates.platformMerchantId,
    });
  });
  const candidate = claimed[0];
  if (!candidate) return { candidateId, status: "skipped", reasons: ["not_pending"] };
  const attempts = Number(candidate.vettingResult?.attempts ?? 0) + 1;
  const providers = providersOf(candidate);
  const base = { attempts, providers, version: VETTING_VERSION, vettedAt: now.toISOString() };

  const park = async (reason: string, retryAt = new Date(now.getTime() + EGRESS_BLOCK_RETRY_MS)): Promise<VetCandidateResult> => {
    const status = platformRetryAt(reason) && !reason.includes("circuit_open") ? "pending" : "blocked_egress";
    await finishCandidate(db, candidate, { status, nextVetAt: retryAt,
      vettingResult: { ...candidate.vettingResult, ...base, attempts: attempts - 1, verdict: status, reasons: [reason] } },
      status === "pending" ? "deferred" : "blocked_egress", [reason], { retryAt: retryAt.toISOString() });
    return { candidateId, status: status === "pending" ? "deferred" : "blocked_egress", reasons: [reason] };
  };

  const defer = async (reason: string): Promise<VetCandidateResult> => {
    if (attempts >= 3) {
      await finishCandidate(db, candidate, { status: "review", vettingResult: { ...base, verdict: "review", reasons: [reason, "max_attempts_reached"] } }, "review", [reason, "max_attempts_reached"], {});
      return { candidateId, status: "review", reasons: [reason, "max_attempts_reached"] };
    }
    await db.update(sourceCandidates).set({ status: "pending", nextVetAt: new Date(now.getTime() + 60 * 60_000), vettingResult: { ...base, deferredReason: reason } }).where(eq(sourceCandidates.id, candidate.id));
    return { candidateId, status: "deferred", reasons: [reason] };
  };

  try {
    let safeUrl: URL;
    try {
      safeUrl = await assertSafePublicUrl(candidate.candidateUrl);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unsafe_url";
      // DNS answers change (parked domains, resolver hiccups); policy violations do not.
      const retryable = /dns|private_address/.test(reason);
      await finishCandidate(db, candidate, {
        status: "rejected",
        ...(retryable ? { nextVetAt: new Date(now.getTime() + thresholds.retryDays * 86_400_000) } : {}),
        vettingResult: { ...base, verdict: "rejected", reasons: [reason] },
      }, "reject", [reason], {});
      return { candidateId, status: "rejected", reasons: [reason] };
    }

    const key = platformKey(safeUrl.hostname);
    const { rows: gates } = await db.execute<{ retry_at: Date | null }>(sql`
      select greatest(blocked_until, lease_until) as retry_at from collector_platform_state where key=${key}`);
    if (gates[0]?.retry_at && new Date(gates[0].retry_at) > now)
      return park("platform_circuit_open", new Date(gates[0].retry_at));
    await db.execute(sql`insert into collector_platform_state(key,last_served_at) values(${key},now())
      on conflict(key) do update set last_served_at=now()`);
    const probes = await registry.probe(safeUrl, signal);
    const selected = probes.find((probe) => probe.supported && probe.identity);
    if (!selected?.identity) {
      const missing = probes.find(probe => /shop_api_rejected:.*(?:不存在|已关闭|已删除|已停用)/.test(probe.reason ?? ''));
      if (missing) {
        const reasons = [missing.reason!];
        await finishCandidate(db, candidate, {status:'rejected',nextVetAt:new Date(now.getTime()+30*86_400_000),
          vettingResult:{...base,verdict:'rejected',reasons,probes}}, 'reject', reasons, {});
        return {candidateId,status:'rejected',reasons};
      }
      const deferredProbe = probes.find(probe => platformRetryAt(probe.reason));
      if (deferredProbe) return park(deferredProbe.reason!, platformRetryAt(deferredProbe.reason)!);
      if (probes.some((probe) => wafBlocked(probe.reason))) {
        const reasons = ["waf_challenge:源站访问验证，此出口暂时无法采集"];
        await finishCandidate(db, candidate, { status: "blocked_egress", nextVetAt: new Date(now.getTime() + EGRESS_BLOCK_RETRY_MS), vettingResult: { ...base, attempts: attempts - 1, verdict: "blocked_egress", reasons, probes } }, "blocked_egress", reasons, {});
        return { candidateId, status: "blocked_egress", reasons };
      }
      const transient = probes.some((probe) => /timeout|fetch failed|ECONN|EAI_AGAIN|http_5\d\d|http_429/i.test(probe.reason ?? ""));
      if (transient) return defer("probe_transient_failure");
      const reasons = ["unsupported_storefront", ...probes.map((probe) => `${probe.collectorKind}:${probe.reason ?? "no"}`).slice(0, 8)];
      await finishCandidate(db, candidate, { status: "adapter_needed", nextVetAt: new Date(now.getTime() + thresholds.retryDays * 86_400_000), vettingResult: { ...base, verdict: "adapter_needed", reasons, probes } }, "adapter_needed", reasons, {});
      return { candidateId, status: "adapter_needed", reasons };
    }
    const identity = selected.identity;

    // Identity is now authoritative. Record it, and stop if the shop already exists.
    const duplicateCandidate = await db.select({ id: sourceCandidates.id }).from(sourceCandidates)
      .where(and(eq(sourceCandidates.platformKind, identity.platformKind), eq(sourceCandidates.platformMerchantId, identity.platformMerchantId), ne(sourceCandidates.id, candidate.id)))
      .limit(1);
    if (duplicateCandidate[0]) {
      const reasons = [`duplicate_candidate:${duplicateCandidate[0].id}`];
      await finishCandidate(db, candidate, { status: "duplicate", vettingResult: { ...base, verdict: "duplicate", reasons, identity } }, "duplicate", reasons, { duplicateOf: duplicateCandidate[0].id });
      return { candidateId, status: "duplicate", reasons };
    }
    await db.update(sourceCandidates).set({ platformKind: identity.platformKind, platformMerchantId: identity.platformMerchantId }).where(eq(sourceCandidates.id, candidate.id));
    const existing = await existingSourceFor(db, identity);
    if (existing && (existing.enabled || existing.id !== candidate.sourceId)) {
      const reasons = [`known_source:${existing.id}`, existing.enabled ? "enabled" : "disabled"];
      await finishCandidate(db, candidate, { status: "duplicate", sourceId: existing.id, vettingResult: { ...base, verdict: "duplicate", reasons, identity } }, "duplicate", reasons, { sourceId: existing.id });
      return { candidateId, status: "duplicate", reasons, sourceId: existing.id };
    }

    // Reuse the submission precheck so the trial crawl, evidence and admin pages match manual intake.
    const name = candidate.merchantNameHint ?? identity.merchantName ?? null;
    const [submission] = await db.insert(sourceSubmissions).values({
      url: identity.canonicalEntryUrl,
      ...(name ? { name } : {}),
      notes: `自动检测：来自 ${providers.join(", ") || "discovery"}`,
      status: "submitted",
    }).returning({ id: sourceSubmissions.id });
    if (!submission) throw new Error("submission_insert_failed");
    await db.update(sourceCandidates).set({ submissionId: submission.id }).where(eq(sourceCandidates.id, candidate.id));
    const precheck = await precheckSourceSubmission(db, registry, submission.id, signal, options.rawObjectStore);
    if (!precheck.supported || !precheck.sourceId) {
      const [stored] = await db.select({ result: sourceSubmissions.precheckResult }).from(sourceSubmissions).where(eq(sourceSubmissions.id, submission.id));
      const precheckProbes = (stored?.result as { probes?: Array<{ reason?: string }> } | null)?.probes ?? [];
      const blocked = precheckProbes.find(probe => platformRetryAt(probe.reason) || wafBlocked(probe.reason));
      if (blocked) {
        await db.update(sourceSubmissions).set({ status: "rejected", reviewedBy: AUTOMATIC_ACTOR, reviewedAt: now }).where(eq(sourceSubmissions.id, submission.id));
        return park(blocked.reason!, platformRetryAt(blocked.reason));
      }
      const reasons = ["precheck_unsupported"];
      await finishCandidate(db, candidate, { status: "adapter_needed", submissionId: submission.id, vettingResult: { ...base, verdict: "adapter_needed", reasons, identity } }, "adapter_needed", reasons, { submissionId: submission.id });
      return { candidateId, status: "adapter_needed", reasons, submissionId: submission.id };
    }
    const sourceId = precheck.sourceId;
    await db.update(sourceCandidates).set({ sourceId }).where(eq(sourceCandidates.id, candidate.id));
    const [trial] = precheck.trialRunId
      ? await db.select({ id: crawlRuns.id, status: crawlRuns.status, complete: crawlRuns.completeSnapshot, errorCode: crawlRuns.errorCode, errorMessage: crawlRuns.errorMessage }).from(crawlRuns).where(eq(crawlRuns.id, precheck.trialRunId)).limit(1)
      : [];
    if (!trial) {
      const [stored] = await db.select({ result: sourceSubmissions.precheckResult }).from(sourceSubmissions).where(eq(sourceSubmissions.id, submission.id)).limit(1);
      const trialError = String((stored?.result as Record<string, unknown> | null)?.trialError ?? "trial_failed");
      if (platformRetryAt(trialError)) return park(trialError, platformRetryAt(trialError));
      if (wafBlocked(trialError)) {
        await db.update(sourceSubmissions).set({ status: "rejected", reviewedBy: AUTOMATIC_ACTOR, reviewedAt: now, updatedAt: now }).where(eq(sourceSubmissions.id, submission.id));
        await db.update(sources).set({ healthStatus: "blocked_egress", lastErrorCode: "waf_challenge", nextRunAt: new Date(now.getTime() + EGRESS_BLOCK_RETRY_MS), updatedAt: now }).where(eq(sources.id, sourceId));
        const reasons = ["waf_challenge:源站访问验证，此出口暂时无法采集"];
        await finishCandidate(db, candidate, { status: "blocked_egress", sourceId, submissionId: submission.id, nextVetAt: new Date(now.getTime() + EGRESS_BLOCK_RETRY_MS), vettingResult: { ...base, attempts: attempts - 1, verdict: "blocked_egress", reasons, identity } }, "blocked_egress", reasons, { sourceId, submissionId: submission.id });
        return { candidateId, status: "blocked_egress", reasons, sourceId, submissionId: submission.id };
      }
      if (/crawl_already_running_or_host_busy|timeout|fetch failed|ECONN|EAI_AGAIN/i.test(trialError)) {
        await db.update(sourceSubmissions).set({ status: "rejected", reviewedBy: AUTOMATIC_ACTOR, reviewedAt: now, updatedAt: now }).where(eq(sourceSubmissions.id, submission.id));
        return defer(`trial_transient:${trialError.slice(0, 80)}`);
      }
      const reasons = [`trial_failed:${trialError.slice(0, 120)}`];
      await finishCandidate(db, candidate, { status: "review", sourceId, submissionId: submission.id, vettingResult: { ...base, verdict: "review", reasons, identity } }, "review", reasons, { sourceId, submissionId: submission.id });
      return { candidateId, status: "review", reasons, sourceId, submissionId: submission.id };
    }

    if (platformRetryAt(trial.errorMessage)) return park(trial.errorMessage!, platformRetryAt(trial.errorMessage));
    if (trial.errorCode === "waf_challenge" || wafBlocked(trial.errorMessage)) {
      await db.update(sourceSubmissions).set({ status: "rejected", reviewedBy: AUTOMATIC_ACTOR, reviewedAt: now, updatedAt: now }).where(eq(sourceSubmissions.id, submission.id));
      await db.update(sources).set({ healthStatus: "blocked_egress", lastErrorCode: "waf_challenge", nextRunAt: new Date(now.getTime() + EGRESS_BLOCK_RETRY_MS), updatedAt: now }).where(eq(sources.id, sourceId));
      const reasons = ["waf_challenge:源站访问验证，此出口暂时无法采集"];
      await finishCandidate(db, candidate, { status: "blocked_egress", sourceId, submissionId: submission.id, nextVetAt: new Date(now.getTime() + EGRESS_BLOCK_RETRY_MS), vettingResult: { ...base, attempts: attempts - 1, verdict: "blocked_egress", reasons, identity, trialRunId: trial.id } }, "blocked_egress", reasons, { sourceId, submissionId: submission.id, trialRunId: trial.id });
      return { candidateId, status: "blocked_egress", reasons, sourceId, submissionId: submission.id, trialRunId: trial.id };
    }
    const items = await loadRunItems(db, trial.id);
    const market = options.context ?? await loadProfileContext(db, { excludeSourceId: sourceId });
    const profile = buildSourceQualityProfile(items, {
      ...market,
      otherCatalogs: market.otherCatalogs.filter((catalog) => catalog.sourceId !== sourceId),
      ...(identity.merchantCreatedAt ? { merchantCreatedAt: identity.merchantCreatedAt } : {}),
      ...(identity.contact ? { contact: identity.contact } : {}),
    });
    const decision = decideVetting(profile, { complete: trial.complete, status: trial.status }, thresholds);
    await upsertProfile(db, sourceId, trial.id, profile, decision.verdict, decision.reasons);
    const vettingResult = { ...base, verdict: decision.verdict, reasons: decision.reasons, identity, trialRunId: trial.id, submissionId: submission.id, sourceId, profile };

    if (decision.verdict === "approved") {
      await db.transaction(async (tx) => {
        await promoteApprovedTrial(tx, sourceId, trial.id, new Date(Date.now() + 12 * 60 * 60_000));
        await tx.update(sourceSubmissions).set({ status: "approved", reviewedBy: AUTOMATIC_ACTOR, reviewedAt: now, updatedAt: now }).where(eq(sourceSubmissions.id, submission.id));
        if (identity.contact && Object.keys(identity.contact).length > 0) {
          await tx.execute(sql`update merchants set contact_public=coalesce(contact_public, ${JSON.stringify(identity.contact)}::jsonb), updated_at=now() where id=(select merchant_id from sources where id=${sourceId}::uuid) and contact_public is null`);
        }
        await tx.insert(auditLogs).values({
          actorId: AUTOMATIC_ACTOR,
          action: "source_submission.approve",
          targetType: "source_submission",
          targetId: submission.id,
          reason: decision.reasons.join("; ").slice(0, 500),
          beforeValue: { status: "review", sourceId },
          afterValue: { status: "approved", sourceId, enabled: true },
        });
      });
      await finishCandidate(db, candidate, { status: "approved", sourceId, submissionId: submission.id, vettingResult }, "approve", decision.reasons, { sourceId, submissionId: submission.id, trialRunId: trial.id });
      return { candidateId, status: "approved", reasons: decision.reasons, sourceId, submissionId: submission.id, trialRunId: trial.id, profile };
    }
    if (decision.verdict === "rejected") {
      await db.update(sourceSubmissions).set({ status: "rejected", reviewedBy: AUTOMATIC_ACTOR, reviewedAt: now, updatedAt: now }).where(eq(sourceSubmissions.id, submission.id));
      await finishCandidate(db, candidate, {
        status: "rejected",
        sourceId,
        submissionId: submission.id,
        nextVetAt: decision.retryAfterDays ? new Date(now.getTime() + decision.retryAfterDays * 86_400_000) : null,
        vettingResult,
      }, "reject", decision.reasons, { sourceId, submissionId: submission.id, trialRunId: trial.id });
      return { candidateId, status: "rejected", reasons: decision.reasons, sourceId, submissionId: submission.id, trialRunId: trial.id, profile };
    }
    await finishCandidate(db, candidate, { status: "review", sourceId, submissionId: submission.id, vettingResult }, "review", decision.reasons, { sourceId, submissionId: submission.id, trialRunId: trial.id });
    return { candidateId, status: "review", reasons: decision.reasons, sourceId, submissionId: submission.id, trialRunId: trial.id, profile };
  } catch (error) {
    if (signal.aborted) {
      await db.update(sourceCandidates).set({ status: "pending", nextVetAt: now }).where(eq(sourceCandidates.id, candidate.id));
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (platformRetryAt(message) || wafBlocked(message)) return park(message, platformRetryAt(message));
    return defer(`vetting_error:${message.slice(0, 120)}`);
  }
}

export interface VetBatchResult {
  attempted: number;
  approved: number;
  review: number;
  rejected: number;
  duplicate: number;
  adapterNeeded: number;
  deferred: number;
  blockedEgress: number;
  results: VetCandidateResult[];
}

export async function vetNextCandidates(db: Database, registry: CollectorRegistry, options: VetCandidateOptions & { limit?: number } = {}): Promise<VetBatchResult> {
  const now = options.now ?? new Date();
  // Recover interrupted processes and scheduled rechecks without requiring a new directory import.
  await db.update(sourceCandidates).set({ status: "pending" }).where(or(
    and(eq(sourceCandidates.status, "vetting"), lt(sourceCandidates.vettedAt, new Date(now.getTime() - 2 * 60 * 60_000))),
    and(inArray(sourceCandidates.status, ["rejected", "adapter_needed", "blocked_egress"]), lt(sourceCandidates.nextVetAt, now)),
  ));
  // Park siblings without probing them. Keep their existing evidence and retry at
  // the platform deadline; selection below still excludes an open circuit.
  await db.execute(sql`with parked as (
    update source_candidates c set status='blocked_egress', next_vet_at=ps.blocked_until,
      vetting_result=coalesce(c.vetting_result,'{}'::jsonb) || jsonb_build_object('platformDeferredReason','platform_circuit_open')
      from collector_platform_state ps where ps.key=${platformKeySql(sql`c.candidate_url`)}
        and ps.blocked_until > now() and c.status='pending' returning c.id
    ) insert into audit_logs(actor_id,action,target_type,target_id,reason,before_value,after_value)
      select ${AUTOMATIC_ACTOR},'source_candidate.blocked_egress','source_candidate',id::text,
        'platform circuit open; no probe issued','{"status":"pending"}'::jsonb,'{"status":"blocked_egress"}'::jsonb from parked`);
  const queue = await findVettableCandidates(db, Math.max(1, options.limit ?? 5), now);
  const summary: VetBatchResult = { attempted: 0, approved: 0, review: 0, rejected: 0, duplicate: 0, adapterNeeded: 0, deferred: 0, blockedEgress: 0, results: [] };
  if (queue.length === 0) return summary;
  const context = options.context ?? await loadProfileContext(db);
  for (const row of queue) {
    if (options.signal?.aborted) break;
    const result = await vetCandidate(db, registry, row.id, { ...options, context, now: new Date() });
    summary.attempted += 1;
    summary.results.push(result);
    if (result.status === "approved") summary.approved += 1;
    else if (result.status === "review") summary.review += 1;
    else if (result.status === "rejected") summary.rejected += 1;
    else if (result.status === "duplicate") summary.duplicate += 1;
    else if (result.status === "adapter_needed") summary.adapterNeeded += 1;
    else if (result.status === "deferred") summary.deferred += 1;
    else if (result.status === "blocked_egress") summary.blockedEgress += 1;
  }
  return summary;
}

/** Recomputes quality profiles for enabled sources from their latest complete run. */
export async function refreshSourceQualityProfiles(db: Database, options: { limit?: number; maxAgeMs?: number; now?: Date } = {}): Promise<{ refreshed: number; degraded: number }> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - (options.maxAgeMs ?? 7 * 86_400_000));
  const rows = await db.select({ id: sources.id, runId: sources.latestCompleteRunId, computedAt: sourceQualityProfiles.computedAt, profileRunId: sourceQualityProfiles.crawlRunId })
    .from(sources)
    .leftJoin(sourceQualityProfiles, eq(sourceQualityProfiles.sourceId, sources.id))
    .where(and(eq(sources.enabled, true), isNotNull(sources.latestCompleteRunId)))
    .limit(2_000);
  const due = rows.filter((row) => row.runId && (row.computedAt === null || row.computedAt < cutoff || row.profileRunId !== row.runId)).slice(0, options.limit ?? 10);
  if (due.length === 0) return { refreshed: 0, degraded: 0 };
  const market = await loadProfileContext(db);
  let degraded = 0;
  for (const row of due) {
    if (!row.runId) continue;
    const items = await loadRunItems(db, row.runId);
    const profile = buildSourceQualityProfile(items, { ...market, otherCatalogs: market.otherCatalogs.filter((catalog) => catalog.sourceId !== row.id) });
    const verdict = profile.itemCount > 0 && profile.aiRelevantCount === 0 ? "degraded" : "healthy";
    if (verdict === "degraded") degraded += 1;
    await upsertProfile(db, row.id, row.runId, profile, verdict, verdict === "degraded" ? ["no_ai_relevant_items"] : []);
  }
  return { refreshed: due.length, degraded };
}

/**
 * Shop API platforms rotate their public domain. Sources still pointing at a
 * retired family host, or failing repeatedly, get their identity re-resolved so
 * the canonical entry URL follows the platform.
 */
export async function repairShopApiEntryUrls(db: Database, registry: CollectorRegistry, options: { limit?: number; signal?: AbortSignal } = {}): Promise<{ checked: number; repaired: number }> {
  const adapter = registry.get("shop_api");
  if (!adapter) return { checked: 0, repaired: 0 };
  const rows = await db.select({ id: sources.id, canonicalEntryUrl: sources.canonicalEntryUrl, platformKind: sources.platformKind, consecutiveFailures: sources.consecutiveFailures, merchantId: sources.merchantId })
    .from(sources)
    .where(and(eq(sources.collectorKind, "shop_api"), ne(sources.healthStatus, "removed"), platformAvailableSql(platformKeySql(sql`${sources.canonicalEntryUrl}`))))
    .limit(2_000);
  const stale = rows.filter((row) => {
    let hostname: string;
    try { hostname = new URL(row.canonicalEntryUrl).hostname; } catch { return false; }
    const family = familyForHost(hostname);
    const retiredHost = family ? new URL(family.primaryOrigin).hostname !== hostname : false;
    return retiredHost || row.consecutiveFailures >= 2;
  }).slice(0, options.limit ?? 20);
  let repaired = 0;
  for (const row of stale) {
    try {
      const identity = await adapter.resolveSourceIdentity(new URL(row.canonicalEntryUrl), options.signal ?? new AbortController().signal);
      if (identity.canonicalEntryUrl === row.canonicalEntryUrl && identity.platformKind === row.platformKind) continue;
      await db.transaction(async (tx) => {
        await tx.update(sources).set({ canonicalEntryUrl: identity.canonicalEntryUrl, platformKind: identity.platformKind, nextRunAt: new Date(), updatedAt: new Date() }).where(eq(sources.id, row.id));
        if (row.merchantId) await tx.update(merchants).set({ websiteUrl: identity.canonicalEntryUrl, updatedAt: new Date() }).where(eq(merchants.id, row.merchantId));
        await tx.insert(auditLogs).values({ actorId: AUTOMATIC_ACTOR, action: "source.repair_entry_url", targetType: "source", targetId: row.id, reason: "platform domain rotation", beforeValue: { canonicalEntryUrl: row.canonicalEntryUrl, platformKind: row.platformKind }, afterValue: { canonicalEntryUrl: identity.canonicalEntryUrl, platformKind: identity.platformKind } });
      });
      repaired += 1;
    } catch {
      // Leave the source to the regular failure backoff; nothing to repair yet.
    }
  }
  return { checked: stale.length, repaired };
}
