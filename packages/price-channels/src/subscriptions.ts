import { parseEcbCnyRates } from "@price-radar/price-channels/exchange-rates";
import { createHash } from "node:crypto";
import {
  exchangeRateSnapshots,
  canonicalProducts,
  officialSubscriptionPlans,
  officialSubscriptionPriceHistory,
  officialSubscriptionPrices,
  officialSubscriptionChecks,
  officialStorefronts,
} from "@price-radar/database/schema";
import * as databaseSchema from "@price-radar/database/schema";
import { and, desc, eq, gte, lte, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  OFFICIAL_SUBSCRIPTION_PLAN_CATALOG,
  OFFICIAL_SUBSCRIPTION_REGION_CATALOG,
  type OfficialSubscriptionPlanCatalogItem,
} from "@price-radar/price-channels/subscription-catalog";
import {
  APPLE_STOREFRONT_CATALOG,
  OFFICIAL_COUNTRY_CANDIDATES,
  findAppleStorefront,
  type AppleStorefrontCatalogItem,
} from "@price-radar/price-channels/storefront-catalog";
import {
  detectCurrencyFromDisplay,
  extractChatGptGoWebPrice,
  extractClaudePlanPrice,
  extractOfficialPagePrice,
  parseAppStoreListings,
  resolveAppStoreListing,
  storefrontFromAppStoreUrl,
} from "@price-radar/price-channels/storefront-parser";
import {
  parseGeminiSubscriptionPage,
  parseGooglePlayInAppRange,
  parseOpenAiCheckoutConfig,
  type GeminiPlanKey,
} from "@price-radar/price-channels/vendor-page-parsers";

type Database = NodePgDatabase<typeof databaseSchema>;

type PriceKind = "exact" | "range" | "unknown";
type Channel = "web" | "app_store" | "google_play";
type StorefrontSource = "apple" | "google_web" | "openai_web";
export type RefreshScope = "full" | "featured";

interface PriceSeed {
  vendor: string;
  planCode: string;
  channel: Channel;
  countryCode: string;
  currency: string;
  priceKind: PriceKind;
  amount?: number;
  lowerAmount?: number;
  upperAmount?: number;
  rawPlanName: string;
  appId?: string;
  evidenceUrl: string;
  evidence?: Record<string, unknown>;
  verificationTerms?: readonly string[];
}

export interface BrowserDocument {
  url: string;
  status: number | null;
  finalUrl: string;
  text: string;
  error?: string;
}

/** 以真实浏览器读取文档；用于被 Cloudflare 挑战拦截普通请求的官方接口。 */
export type BrowserDocumentFetcher = (urls: readonly string[]) => Promise<BrowserDocument[]>;

export interface SubscriptionRefreshOptions {
  /** featured：只处理页面默认展示的重点地区，用于时间受限的触发端点。 */
  scope?: RefreshScope;
  fetchDocuments?: BrowserDocumentFetcher;
  onError?: (source: string, error: unknown) => void;
}

export interface SubscriptionRefreshResult {
  scope: RefreshScope;
  exchangeRates: number;
  seededPrices: number;
  verifiedWebPrices: number;
  appStorePrices: number;
  appStoreStorefronts: number;
  appStoreThrottleRetries: number;
  appStoreThrottleCooldownMs: number;
  googleWebPrices: number;
  googleWebCountries: number;
  googlePlayRanges: number;
  googlePlayChecks: number;
  openAiWebPrices: number;
  openAiWebCountries: number;
  openAiWebSkipped: boolean;
}

const PLAN_SEEDS = OFFICIAL_SUBSCRIPTION_PLAN_CATALOG;
const USER_AGENT = "AIPriceRadar/0.1 (+public-price-verification)";
const RESCAN_NOT_AVAILABLE_AFTER_MS = 30 * 24 * 60 * 60 * 1_000;
const FEATURED_COUNTRY_CODES = OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map((region) => region.countryCode);

/** ECB 每日参考汇率覆盖的货币；其他币种暂无汇率，人民币估算留空。 */
const ECB_REFERENCE_CURRENCIES = new Set([
  "USD", "JPY", "BGN", "CZK", "DKK", "GBP", "HUF", "PLN", "RON", "SEK", "CHF", "ISK", "NOK", "TRY", "AUD", "BRL", "CAD",
  "CNY", "HKD", "IDR", "ILS", "INR", "KRW", "MXN", "MYR", "NZD", "PHP", "SGD", "THB", "ZAR",
]);

const CANONICAL_SLUG_BY_PLAN: Readonly<Record<string, string>> = {
  "openai:chatgpt-plus-monthly": "chatgpt-plus",
  "openai:chatgpt-pro-5x-monthly": "chatgpt-pro",
  "openai:chatgpt-pro-20x-monthly": "chatgpt-pro",
  "anthropic:claude-pro-monthly": "claude-pro",
  "anthropic:claude-max-5x-monthly": "claude-max-5x",
  "anthropic:claude-max-20x-monthly": "claude-max-20x",
  "xai:supergrok-monthly": "supergrok",
};

const VERIFIED_WEB_PRICES: readonly PriceSeed[] = [
  { vendor: "openai", planCode: "chatgpt-plus-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 20, rawPlanName: "ChatGPT Plus", evidenceUrl: "https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus", evidence: { billing: "monthly", officialArticleUpdated: "2026-08-17" }, verificationTerms: ["ChatGPT Plus"] },
  { vendor: "openai", planCode: "chatgpt-pro-5x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "Pro $100 (5x)", evidenceUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", evidence: { usageMultiple: 5, officialArticleUpdated: "2026-08-26" }, verificationTerms: ["ChatGPT Pro", "5x"] },
  { vendor: "openai", planCode: "chatgpt-pro-20x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Pro $200 (20x)", evidenceUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", evidence: { usageMultiple: 20, officialArticleUpdated: "2026-08-26" }, verificationTerms: ["ChatGPT Pro", "20x"] },
  { vendor: "anthropic", planCode: "claude-pro-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 20, rawPlanName: "Pro", evidenceUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan", verificationTerms: ["Pro"] },
  { vendor: "anthropic", planCode: "claude-pro-annual", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Pro annual", evidenceUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan", evidence: { billedUpfront: true }, verificationTerms: ["Pro"] },
  { vendor: "anthropic", planCode: "claude-max-5x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "Max 5x", evidenceUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan", evidence: { usageMultiple: 5 }, verificationTerms: ["Max 5x", "Claude"] },
  { vendor: "anthropic", planCode: "claude-max-20x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Max 20x", evidenceUrl: "https://support.claude.com/en/articles/11049762-choose-a-claude-plan", evidence: { usageMultiple: 20 }, verificationTerms: ["Max 20x", "Claude"] },
  { vendor: "xai", planCode: "supergrok-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 30, rawPlanName: "SuperGrok", evidenceUrl: "https://x.ai/pricing", verificationTerms: ["SuperGrok"] },
  { vendor: "xai", planCode: "supergrok-plus-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "SuperGrok Plus", evidenceUrl: "https://x.ai/pricing", verificationTerms: ["SuperGrok Plus"] },
];

// Announcement fallback is historical evidence, never a newly verified checkout price.
const GO_ANNOUNCEMENT_PRICE: PriceSeed = {
  vendor: "openai", planCode: "chatgpt-go-monthly", channel: "web", countryCode: "US",
  currency: "USD", priceKind: "exact", amount: 8, rawPlanName: "ChatGPT Go",
  evidenceUrl: "https://openai.com/index/introducing-chatgpt-go/",
  evidence: { sourceKind: "announcement", publishedAt: "2026-01-16", countryScope: "US" },
};
const LIVE_WEB_PRICES: readonly PriceSeed[] = [...VERIFIED_WEB_PRICES, {
  ...GO_ANNOUNCEMENT_PRICE, evidenceUrl: "https://chatgpt.com/pricing/",
  evidence: { sourceKind: "pricing_page", countryScope: "US" }, verificationTerms: ["Go"],
}];

interface AppStoreAlias {
  rawPlanName: string;
  planCode: string;
  mustBeLessThanPlanName?: string;
}

interface AppStoreTarget {
  appId: string;
  vendor: string;
  /** 同页可能出现的全部套餐名，用于解释同名重复项（规则 D）。 */
  knownPlanNames: readonly string[];
  aliases: readonly AppStoreAlias[];
}

const APP_STORE_TARGETS: readonly AppStoreTarget[] = [
  {
    appId: "6448311069",
    vendor: "openai",
    knownPlanNames: ["ChatGPT Go", "ChatGPT Plus", "ChatGPT Pro 5x", "ChatGPT Pro 20x"],
    aliases: [
      { rawPlanName: "ChatGPT Go", planCode: "chatgpt-go-monthly" },
      { rawPlanName: "ChatGPT Plus", planCode: "chatgpt-plus-monthly", mustBeLessThanPlanName: "ChatGPT Pro 5x" },
      { rawPlanName: "ChatGPT Pro 5x", planCode: "chatgpt-pro-5x-monthly" },
      { rawPlanName: "ChatGPT Pro 20x", planCode: "chatgpt-pro-20x-monthly" },
    ],
  },
  {
    appId: "6473753684",
    vendor: "anthropic",
    knownPlanNames: ["Claude Pro - Monthly", "Claude Pro - Annual", "Claude Max 5x - Monthly", "Claude Max 20x - Monthly"],
    aliases: [
      { rawPlanName: "Claude Pro - Monthly", planCode: "claude-pro-monthly" },
      { rawPlanName: "Claude Pro - Annual", planCode: "claude-pro-annual" },
      { rawPlanName: "Claude Max 5x - Monthly", planCode: "claude-max-5x-monthly" },
      { rawPlanName: "Claude Max 20x - Monthly", planCode: "claude-max-20x-monthly" },
    ],
  },
  {
    appId: "6477489729",
    vendor: "google",
    knownPlanNames: ["Google AI Plus (400 GB)", "Google AI Pro (5 TB)", "Google AI Ultra (20 TB)", "Google AI Ultra (30 TB)"],
    aliases: [
      { rawPlanName: "Google AI Plus (400 GB)", planCode: "google-ai-plus-monthly" },
      { rawPlanName: "Google AI Pro (5 TB)", planCode: "google-ai-pro-monthly" },
      { rawPlanName: "Google AI Ultra (20 TB)", planCode: "google-ai-ultra-5x-monthly" },
      { rawPlanName: "Google AI Ultra (30 TB)", planCode: "google-ai-ultra-monthly" },
    ],
  },
  {
    appId: "6670324846",
    vendor: "xai",
    knownPlanNames: ["SuperGrok", "SuperGrok Plus", "SuperGrok Lite", "SuperGrok Heavy"],
    aliases: [
      { rawPlanName: "SuperGrok", planCode: "supergrok-monthly" },
      { rawPlanName: "SuperGrok Plus", planCode: "supergrok-plus-monthly" },
    ],
  },
];

const GOOGLE_PLAY_APPS: Readonly<Record<string, string>> = {
  openai: "com.openai.chatgpt",
  anthropic: "com.anthropic.claude",
  google: "com.google.android.apps.bard",
  xai: "ai.x.grok",
};

const GEMINI_PLAN_CODES: Readonly<Record<GeminiPlanKey, string>> = {
  plus: "google-ai-plus-monthly",
  pro: "google-ai-pro-monthly",
  ultra_5x: "google-ai-ultra-5x-monthly",
  ultra_20x: "google-ai-ultra-monthly",
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashEvidence(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function numberString(value: number | undefined): string | null {
  return value === undefined ? null : value.toFixed(6);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "fetch_failed";
}

const planIdCache = new Map<string, string>();
const rateCache = new Map<string, { id: string | null; rate: number } | null>();

function resetRunCaches(): void {
  planIdCache.clear();
  rateCache.clear();
}

async function upsertPlan(database: Database, seed: OfficialSubscriptionPlanCatalogItem): Promise<string> {
  const cacheKey = `${seed.vendor}:${seed.planCode}`;
  const cached = planIdCache.get(cacheKey);
  if (cached) return cached;
  const canonicalSlug = CANONICAL_SLUG_BY_PLAN[cacheKey];
  const [canonical] = canonicalSlug
    ? await database.select({ id: canonicalProducts.id }).from(canonicalProducts).where(eq(canonicalProducts.slug, canonicalSlug)).limit(1)
    : [];
  const [row] = await database
    .insert(officialSubscriptionPlans)
    .values({ ...seed, canonicalProductId: canonical?.id ?? null })
    .onConflictDoUpdate({
      target: [officialSubscriptionPlans.vendor, officialSubscriptionPlans.planCode],
      set: { displayName: seed.displayName, billingPeriod: seed.billingPeriod, officialUrl: seed.officialUrl, canonicalProductId: canonical?.id ?? null, active: true, updatedAt: new Date() },
    })
    .returning({ id: officialSubscriptionPlans.id });
  if (!row) throw new Error("official_subscription_plan_upsert_failed");
  planIdCache.set(cacheKey, row.id);
  return row.id;
}

async function latestCnyRate(database: Database, currency: string) {
  if (currency === "CNY") return { id: null, rate: 1 };
  if (rateCache.has(currency)) return rateCache.get(currency) ?? null;
  const [row] = await database
    .select({ id: exchangeRateSnapshots.id, rate: exchangeRateSnapshots.rate })
    .from(exchangeRateSnapshots)
    .where(and(eq(exchangeRateSnapshots.baseCurrency, currency), eq(exchangeRateSnapshots.quoteCurrency, "CNY"),
      lte(exchangeRateSnapshots.effectiveDate, new Date().toISOString().slice(0, 10)),
      gte(exchangeRateSnapshots.effectiveDate, new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)),
      gt(exchangeRateSnapshots.rate, "0")))
    .orderBy(desc(exchangeRateSnapshots.effectiveDate))
    .limit(1);
  const rate = row && Number.isFinite(Number(row.rate)) ? { id: row.id, rate: Number(row.rate) } : null;
  rateCache.set(currency, rate);
  return rate;
}

async function upsertPrice(
  database: Database,
  seed: PriceSeed,
  verifiedAt: Date,
  options: { preserveVerifiedAtWhenUnchanged?: boolean } = {},
): Promise<void> {
  const plan = PLAN_SEEDS.find((item) => item.vendor === seed.vendor && item.planCode === seed.planCode);
  if (!plan) throw new Error(`unknown_official_plan:${seed.vendor}:${seed.planCode}`);
  const planId = await upsertPlan(database, plan);
  const rate = await latestCnyRate(database, seed.currency);
  const cnyEstimate = seed.amount !== undefined && rate ? seed.amount * rate.rate : undefined;
  const normalizedCnyEstimate = numberString(cnyEstimate);
  const exchangeRateSnapshotId = rate?.id ?? null;
  const evidence = { ...(seed.evidence ?? {}), priceKind: seed.priceKind };
  const evidenceHash = hashEvidence({
    vendor: seed.vendor,
    planCode: seed.planCode,
    channel: seed.channel,
    countryCode: seed.countryCode,
    currency: seed.currency,
    priceKind: seed.priceKind,
    amount: seed.amount,
    lowerAmount: seed.lowerAmount,
    upperAmount: seed.upperAmount,
    rawPlanName: seed.rawPlanName,
    appId: seed.appId,
    evidenceUrl: seed.evidenceUrl,
    evidence,
  });
  const [existing] = await database
    .select()
    .from(officialSubscriptionPrices)
    .where(and(
      eq(officialSubscriptionPrices.planId, planId),
      eq(officialSubscriptionPrices.channel, seed.channel),
      eq(officialSubscriptionPrices.countryCode, seed.countryCode),
      eq(officialSubscriptionPrices.rawPlanName, seed.rawPlanName),
    ))
    .limit(1);
  // Historical seeds must never replace newer live evidence when a fetch fails.
  if (options.preserveVerifiedAtWhenUnchanged && existing && existing.verifiedAt > verifiedAt) {
    return;
  }
  const sourcePriceChanged = !existing || existing.evidenceHash !== evidenceHash;
  const conversionChanged = Boolean(existing) && (
    existing?.cnyEstimate !== normalizedCnyEstimate
    || existing?.exchangeRateSnapshotId !== exchangeRateSnapshotId
  );
  const shouldTouchVerification = sourcePriceChanged || !options.preserveVerifiedAtWhenUnchanged;
  const updatedAt = new Date();
  const conflictValues = {
    currency: seed.currency,
    priceKind: seed.priceKind,
    amount: numberString(seed.amount),
    lowerAmount: numberString(seed.lowerAmount),
    upperAmount: numberString(seed.upperAmount),
    cnyEstimate: normalizedCnyEstimate,
    exchangeRateSnapshotId,
    appId: seed.appId ?? null,
    evidenceUrl: seed.evidenceUrl,
    evidence,
    evidenceHash,
    ...(shouldTouchVerification ? { verifiedAt } : {}),
    ...(shouldTouchVerification || conversionChanged ? { updatedAt } : {}),
  };
  const [price] = await database
    .insert(officialSubscriptionPrices)
    .values({
      planId,
      channel: seed.channel,
      countryCode: seed.countryCode,
      currency: seed.currency,
      priceKind: seed.priceKind,
      amount: numberString(seed.amount),
      lowerAmount: numberString(seed.lowerAmount),
      upperAmount: numberString(seed.upperAmount),
      cnyEstimate: normalizedCnyEstimate,
      exchangeRateSnapshotId,
      rawPlanName: seed.rawPlanName,
      appId: seed.appId ?? null,
      evidenceUrl: seed.evidenceUrl,
      evidence,
      evidenceHash,
      verifiedAt,
    })
    .onConflictDoUpdate({
      target: [officialSubscriptionPrices.planId, officialSubscriptionPrices.channel, officialSubscriptionPrices.countryCode, officialSubscriptionPrices.rawPlanName],
      set: conflictValues,
    })
    .returning({ id: officialSubscriptionPrices.id });
  if (!price) throw new Error("official_subscription_price_upsert_failed");
  if (sourcePriceChanged || conversionChanged) {
    await database.insert(officialSubscriptionPriceHistory).values({
      officialPriceId: price.id,
      currency: seed.currency,
      priceKind: seed.priceKind,
      amount: numberString(seed.amount),
      lowerAmount: numberString(seed.lowerAmount),
      upperAmount: numberString(seed.upperAmount),
      cnyEstimate: normalizedCnyEstimate,
      evidenceUrl: seed.evidenceUrl,
      evidenceHash,
      observedAt: sourcePriceChanged ? verifiedAt : updatedAt,
    });
  }
}

export async function seedVerifiedSubscriptionPrices(database: Database): Promise<number> {
  // These values were manually checked from official pages; scheduled jobs must not make them appear newly fetched.
  const verifiedAt = new Date("2026-09-04T00:00:00.000Z");
  for (const plan of PLAN_SEEDS) await upsertPlan(database, plan);
  for (const price of VERIFIED_WEB_PRICES) {
    await upsertPrice(database, price, verifiedAt, { preserveVerifiedAtWhenUnchanged: true });
  }
  await upsertPrice(database, GO_ANNOUNCEMENT_PRICE, new Date("2026-01-16T00:00:00.000Z"), { preserveVerifiedAtWhenUnchanged: true });
  // Explicit manual source review on 2026-09-07; scheduled refreshes keep this fixed timestamp.
  const reviewedAt = new Date("2026-09-07T09:04:00.000Z");
  for (const price of VERIFIED_WEB_PRICES) {
    const plan = PLAN_SEEDS.find(plan => plan.planCode === price.planCode)!;
    await upsertPrice(database, { ...price, evidence: { ...price.evidence, sourceKind: "official_public_price", billingPeriod: plan.billingPeriod, billingEvidenceUrl: price.evidenceUrl, taxTreatment: "checkout_required", verificationMethod: "official_document_manual_review", reviewDocument: "docs/research/official-subscription-verification-2026-09-07.md" } }, reviewedAt, { preserveVerifiedAtWhenUnchanged: true });
  }
  return VERIFIED_WEB_PRICES.length + 1;
}

interface CheckDetails {
  httpStatus?: number | null;
  finalUrl?: string | null;
  parsedCount?: number | null;
  evidence?: Record<string, unknown>;
}

async function recordCheck(
  database: Database,
  plan: { vendor: string; planCode: string },
  channel: Channel,
  countryCode: string,
  status: string,
  reason: string,
  evidenceUrl: string,
  checkedAt: Date,
  details: CheckDetails = {},
): Promise<void> {
  const values = {
    vendor: plan.vendor, planCode: plan.planCode, channel, countryCode, status, reason, evidenceUrl, checkedAt,
    httpStatus: details.httpStatus ?? null, finalUrl: details.finalUrl ?? null, parsedCount: details.parsedCount ?? null,
    evidence: details.evidence ?? {},
  };
  await database.insert(officialSubscriptionChecks).values(values).onConflictDoUpdate({
    target: [officialSubscriptionChecks.vendor, officialSubscriptionChecks.planCode, officialSubscriptionChecks.channel, officialSubscriptionChecks.countryCode], set: values,
  });
}

async function recordStorefront(
  database: Database,
  source: StorefrontSource,
  countryCode: string,
  patch: { storefront?: string | null; currency?: string | null; status: "available" | "not_available" | "unknown"; detail?: string | null },
  checkedAt: Date,
): Promise<void> {
  const values = {
    source, countryCode, storefront: patch.storefront ?? null, currency: patch.currency ?? null, status: patch.status,
    detail: patch.detail ?? null, lastCheckedAt: checkedAt, updatedAt: checkedAt,
    ...(patch.status === "available" ? { lastAvailableAt: checkedAt } : {}),
  };
  await database.insert(officialStorefronts).values(values).onConflictDoUpdate({
    target: [officialStorefronts.source, officialStorefronts.countryCode], set: values,
  });
}

/**
 * 首轮枚举全部候选国家；之后每天只访问可用或状态未知的国家，
 * 已确认未上架的国家每 30 天复扫一次以发现新开放的市场。
 */
async function candidateCountries(database: Database, source: StorefrontSource, candidates: readonly string[], now: Date): Promise<string[]> {
  const rows = await database
    .select({ countryCode: officialStorefronts.countryCode, status: officialStorefronts.status, lastCheckedAt: officialStorefronts.lastCheckedAt })
    .from(officialStorefronts)
    .where(eq(officialStorefronts.source, source));
  if (!rows.length) return [...candidates];
  const known = new Map(rows.map((row) => [row.countryCode, row]));
  return candidates.filter((code) => {
    const row = known.get(code);
    if (!row || row.status !== "not_available") return true;
    return now.getTime() - (row.lastCheckedAt?.getTime() ?? 0) > RESCAN_NOT_AVAILABLE_AFTER_MS;
  });
}

interface FetchedPage {
  status: number;
  finalUrl: string;
  text: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 同一来源的请求节流：请求起点之间保持最小间隔，收到 429/503 后所有并发共享冷却期。
 * Apple 对约每秒数次的连续请求会返回 429；每日全量采集宁可慢几分钟也不触发限流。
 */
class SourceGate {
  #cooldownUntil = 0;
  #lastStart = 0;
  readonly #minIntervalMs: number;
  /** 收到可重试状态码后的重试次数与累计冷却毫秒数，用于观察来源限流。 */
  retries = 0;
  cooldownTotalMs = 0;

  constructor(minIntervalMs: number) {
    this.#minIntervalMs = minIntervalMs;
  }

  async wait(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const next = Math.max(this.#cooldownUntil, this.#lastStart + this.#minIntervalMs);
      if (next <= now) {
        this.#lastStart = now;
        return;
      }
      await sleep(next - now);
    }
  }

  cooldown(ms: number): void {
    this.retries += 1;
    this.cooldownTotalMs += ms;
    this.#cooldownUntil = Math.max(this.#cooldownUntil, Date.now() + ms);
  }
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1_000, 90_000);
  return Math.min(2_000 * 2 ** attempt + Math.floor(Math.random() * 1_000), 60_000);
}

async function fetchPage(
  url: string,
  options: { timeoutMs?: number; accept?: string; gate?: SourceGate; attempts?: number } = {},
): Promise<FetchedPage> {
  const attempts = Math.max(1, options.attempts ?? 1);
  for (let attempt = 0; ; attempt += 1) {
    await options.gate?.wait();
    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "en-US,en;q=0.9",
          ...(options.accept ? { accept: options.accept } : {}),
        },
      });
    } catch (error) {
      if (attempt + 1 >= attempts) throw error;
      await sleep(2_000 * (attempt + 1));
      continue;
    }
    if (RETRYABLE_STATUSES.has(response.status) && attempt + 1 < attempts) {
      const delay = retryDelayMs(response, attempt);
      options.gate?.cooldown(delay);
      await response.body?.cancel().catch(() => undefined);
      await sleep(delay);
      continue;
    }
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length > 5_000_000) throw new Error("price_source_too_large");
    const text = await response.text();
    if (text.length > 5_000_000) throw new Error("price_source_too_large");
    return { status: response.status, finalUrl: response.url || url, text };
  }
}

async function fetchText(url: string): Promise<string> {
  const page = await fetchPage(url, { timeoutMs: 8_000 });
  if (page.status < 200 || page.status >= 300) throw new Error(`price_source_http_${page.status}`);
  return page.text;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function verifyOfficialWebPrices(database: Database, verifiedAt = new Date()): Promise<number> {
  const referencePlans = PLAN_SEEDS.filter(plan => ["anthropic", "xai"].includes(plan.vendor));
  const sourceUrls = [...new Set(LIVE_WEB_PRICES.filter(price => referencePlans.some(plan => plan.planCode === price.planCode)).map(price => price.evidenceUrl))];
  const fetchedPages = await mapWithConcurrency(sourceUrls, 4, async sourceUrl => {
    try { return [sourceUrl, { html: await fetchText(sourceUrl), error: "" }] as const; }
    catch (error) { return [sourceUrl, { html: null, error: errorMessage(error) }] as const; }
  });
  const pages = new Map<string, { html: string | null; error: string }>(fetchedPages);
  let verified = 0;
  for (const plan of referencePlans) {
    const price = LIVE_WEB_PRICES.find(price => price.vendor === plan.vendor && price.planCode === plan.planCode);
    const url = price?.evidenceUrl ?? plan.officialUrl;
    const page = pages.get(url);
    let amount: number | null = null;
    if (page?.html && price?.verificationTerms) {
      amount = plan.vendor === "anthropic" ? extractClaudePlanPrice(page.html, plan.planCode)
        : plan.planCode === "chatgpt-go-monthly" ? extractChatGptGoWebPrice(page.html)
        : extractOfficialPagePrice(page.html, price.verificationTerms);
      if (amount !== null && price.amount !== undefined && (amount < price.amount * 0.25 || amount > price.amount * 4)) amount = null;
    }
    if (amount !== null && price) {
      await upsertPrice(database, { ...price, amount, evidence: { ...price.evidence, sourceKind: "official_public_price", publicPageParsed: true, billingPeriod: plan.billingPeriod, billingEvidenceUrl: price.evidenceUrl, taxTreatment: "checkout_required" } }, verifiedAt);
      verified++;
    }
    for (const region of OFFICIAL_SUBSCRIPTION_REGION_CATALOG) {
      const status = region.countryCode !== "US" ? "regional_checkout_required" : !page?.html ? "fetch_failed" : amount !== null ? "verified" : "price_not_public";
      const reason = status === "fetch_failed" ? `来源访问失败：${page?.error ?? "fetch_failed"}`
        : status === "regional_checkout_required" ? "公开参考页未提供该地区的结算价，需登录官网升级页或应用商店核验"
        : status === "verified" ? "已从官方页面解析套餐价格" : "公开页未提供能对应此套餐、币种与周期的精确价格";
      await recordCheck(database, plan, "web", region.countryCode, status, reason, url, verifiedAt);
    }
  }
  return verified;
}

// ---------------------------------------------------------------------------
// Google 官网各国页
// ---------------------------------------------------------------------------

export interface VendorMonthlyReference {
  amount: number;
  currency: string;
  evidenceUrl: string;
}

export interface GoogleWebCollectionResult {
  prices: number;
  countries: number;
  /** `${planCode}:${countryCode}` → 官网月付金额与来源，供 Apple 内购周期交叉确认（规则 C）。 */
  monthlyAmounts: Map<string, VendorMonthlyReference>;
}

export async function collectGoogleWebPrices(
  database: Database,
  verifiedAt = new Date(),
  options: { scope?: RefreshScope; countries?: readonly string[] } = {},
): Promise<GoogleWebCollectionResult> {
  const googlePlans = PLAN_SEEDS.filter((plan) => plan.vendor === "google");
  const countries = options.countries
    ?? (options.scope === "featured" ? FEATURED_COUNTRY_CODES : await candidateCountries(database, "google_web", OFFICIAL_COUNTRY_CANDIDATES, verifiedAt));
  const monthlyAmounts = new Map<string, VendorMonthlyReference>();
  const gate = new SourceGate(500);
  let prices = 0;
  let available = 0;
  await mapWithConcurrency(countries, 3, async (countryCode) => {
    const url = `https://gemini.google/${countryCode.toLowerCase()}/subscriptions/?hl=en`;
    const fallbackCurrency = findAppleStorefront(countryCode)?.currency;
    const failAll = async (status: string, reason: string, details: CheckDetails = {}) => {
      for (const plan of googlePlans) await recordCheck(database, plan, "web", countryCode, status, reason, url, verifiedAt, details);
    };
    let page: FetchedPage;
    try {
      page = await fetchPage(url, { gate, attempts: 3 });
    } catch (error) {
      await failAll("fetch_failed", `来源访问失败：${errorMessage(error)}`);
      await recordStorefront(database, "google_web", countryCode, { status: "unknown", detail: errorMessage(error) }, verifiedAt);
      return;
    }
    if (page.status === 404) {
      await failAll("not_available", "该地区订阅页面返回 HTTP 404；不据此判断订阅购买资格", { httpStatus: 404, finalUrl: page.finalUrl });
      await recordStorefront(database, "google_web", countryCode, { status: "not_available", detail: "http_404" }, verifiedAt);
      return;
    }
    if (page.status !== 200) {
      await failAll("fetch_failed", `来源访问失败：price_source_http_${page.status}`, { httpStatus: page.status, finalUrl: page.finalUrl });
      await recordStorefront(database, "google_web", countryCode, { status: "unknown", detail: `http_${page.status}` }, verifiedAt);
      return;
    }
    const parsed = parseGeminiSubscriptionPage(page.text, fallbackCurrency);
    if (parsed.canonicalCountry !== countryCode.toUpperCase()) {
      await failAll("country_fallback", `页面回落到 ${parsed.canonicalCountry} 的内容，未采集`, { httpStatus: page.status, finalUrl: page.finalUrl, parsedCount: parsed.plans.length });
      await recordStorefront(database, "google_web", countryCode, { status: "unknown", detail: `fallback_${parsed.canonicalCountry}` }, verifiedAt);
      return;
    }
    if (!parsed.cardCount) {
      await failAll("parser_drift", "页面结构未包含可解析的套餐卡片，保留上一份记录", { httpStatus: page.status, finalUrl: page.finalUrl, parsedCount: 0 });
      await recordStorefront(database, "google_web", countryCode, { status: "unknown", detail: "parser_drift" }, verifiedAt);
      return;
    }
    available += 1;
    const currency = parsed.plans.find((plan) => plan.currency)?.currency ?? fallbackCurrency ?? null;
    await recordStorefront(database, "google_web", countryCode, { status: "available", currency }, verifiedAt);
    for (const plan of googlePlans) {
      const key = (Object.keys(GEMINI_PLAN_CODES) as GeminiPlanKey[]).find((candidate) => GEMINI_PLAN_CODES[candidate] === plan.planCode);
      const price = key ? parsed.plans.find((item) => item.planKey === key) : undefined;
      const details: CheckDetails = { httpStatus: page.status, finalUrl: page.finalUrl, parsedCount: parsed.plans.length };
      if (!price || !price.amountText) {
        await recordCheck(database, plan, "web", countryCode, "price_not_public", "该国页面的套餐卡片没有显示金额", url, verifiedAt, details);
        continue;
      }
      if (!price.currency || price.amount === null) {
        await recordCheck(database, plan, "web", countryCode, "currency_unknown", `无法确认金额“${price.amountText}”的币种或数值`, url, verifiedAt, { ...details, evidence: { priceText: price.priceText } });
        continue;
      }
      await upsertPrice(database, {
        vendor: plan.vendor,
        planCode: plan.planCode,
        channel: "web",
        countryCode,
        currency: price.currency,
        priceKind: "exact",
        amount: price.amount,
        rawPlanName: price.planName,
        evidenceUrl: url,
        evidence: {
          sourceOwner: "Google",
          sourceKind: "official_public_price",
          displayedAmount: price.amountText,
          priceText: price.priceText,
          ...(price.periodConfirmed ? { billingPeriod: "month", billingEvidenceUrl: url, billingEvidenceMethod: "official_page_explicit_period" } : {}),
          taxTreatment: "checkout_required",
        },
      }, verifiedAt);
      if (price.periodConfirmed) monthlyAmounts.set(`${plan.planCode}:${countryCode}`, { amount: price.amount, currency: price.currency, evidenceUrl: url });
      prices += 1;
      await recordCheck(database, plan, "web", countryCode, price.periodConfirmed ? "verified" : "billing_unverified",
        price.periodConfirmed ? "已从 Google 官网该国页面解析套餐月价；税费与购买资格以结算页为准" : "已解析金额，但页面未明示计费周期",
        url, verifiedAt, { ...details, evidence: { priceText: price.priceText } });
    }
  });
  return { prices, countries: available, monthlyAmounts };
}

// ---------------------------------------------------------------------------
// Apple App Store 各商店
// ---------------------------------------------------------------------------

export interface AppleCollectionResult {
  prices: number;
  storefronts: number;
  throttleRetries: number;
  throttleCooldownMs: number;
}

export async function collectAppleAppStorePrices(
  database: Database,
  verifiedAt = new Date(),
  options: { scope?: RefreshScope; storefronts?: readonly AppleStorefrontCatalogItem[]; googleWebMonthlyAmounts?: ReadonlyMap<string, VendorMonthlyReference> } = {},
): Promise<AppleCollectionResult> {
  // Same-country vendor web prices: Google country pages plus the manually reviewed US web prices.
  const webMonthly = new Map<string, VendorMonthlyReference>(options.googleWebMonthlyAmounts ?? []);
  for (const seed of VERIFIED_WEB_PRICES) {
    const plan = PLAN_SEEDS.find((item) => item.vendor === seed.vendor && item.planCode === seed.planCode);
    if (plan?.billingPeriod === "month" && seed.amount !== undefined) webMonthly.set(`${seed.planCode}:${seed.countryCode}`, { amount: seed.amount, currency: seed.currency, evidenceUrl: seed.evidenceUrl });
  }
  const storefronts = options.storefronts ?? (options.scope === "featured"
    ? FEATURED_COUNTRY_CODES.flatMap((code) => { const item = findAppleStorefront(code); return item ? [item] : []; })
    : await (async () => {
      const codes = new Set(await candidateCountries(database, "apple", OFFICIAL_COUNTRY_CANDIDATES, verifiedAt));
      return APPLE_STOREFRONT_CATALOG.filter((item) => codes.has(item.countryCode));
    })());
  const jobs = APP_STORE_TARGETS.flatMap((target) => storefronts.map((region) => ({ target, region })));
  const availableStorefronts = new Set<string>();
  // Apple throttles bursts with HTTP 429: keep about two requests per second and back off on 429.
  const gate = new SourceGate(600);
  const results = await mapWithConcurrency(jobs, 2, async ({ target, region }) => {
    const evidenceUrl = `https://apps.apple.com/${region.storefront}/app/id${target.appId}`;
    const failAll = async (status: string, reason: string, details: CheckDetails = {}) => {
      for (const alias of target.aliases) await recordCheck(database, { vendor: target.vendor, planCode: alias.planCode }, "app_store", region.countryCode, status, reason, evidenceUrl, verifiedAt, details);
    };
    let page: FetchedPage;
    try {
      page = await fetchPage(evidenceUrl, { gate, attempts: 4 });
    } catch (error) {
      await failAll("fetch_failed", `来源访问失败：${errorMessage(error)}`);
      return 0;
    }
    const details: CheckDetails = { httpStatus: page.status, finalUrl: page.finalUrl };
    if (page.status === 404) {
      await failAll("not_available", "该商店应用页面返回 HTTP 404；不据此判断账号购买资格", details);
      return 0;
    }
    if (page.status !== 200) {
      await failAll("fetch_failed", `来源访问失败：price_source_http_${page.status}`, details);
      return 0;
    }
    const finalStorefront = storefrontFromAppStoreUrl(page.finalUrl);
    if (finalStorefront !== region.storefront) {
      await failAll("storefront_redirected", `Apple 将请求重定向到 ${finalStorefront} 商店，未采集`, details);
      return 0;
    }
    const parsed = parseAppStoreListings(page.text, region.currency);
    details.parsedCount = parsed.listings.length;
    if (parsed.storefront && parsed.storefront !== region.storefront) {
      await failAll("storefront_redirected", "页面内嵌数据的商店与请求地区不一致，未采集", details);
      return 0;
    }
    if (parsed.parser === "none") {
      await failAll("parser_drift", "页面结构未包含可解析的内购列表，保留上一份记录", details);
      return 0;
    }
    availableStorefronts.add(region.countryCode);
    let saved = 0;
    for (const alias of target.aliases) {
      const plan = { vendor: target.vendor, planCode: alias.planCode };
      const webReference = webMonthly.get(`${alias.planCode}:${region.countryCode}`);
      const resolution = resolveAppStoreListing(parsed.listings, alias.rawPlanName, {
        otherPlanNames: target.knownPlanNames,
        ...(alias.mustBeLessThanPlanName ? { mustBeLessThanPlanName: alias.mustBeLessThanPlanName } : {}),
        ...(webReference ? { vendorMonthlyAmount: webReference.amount } : {}),
      });
      const listingEvidence = { parser: parsed.parser, amounts: resolution.amounts, duplicateOf: resolution.duplicateOf, resolvedBy: resolution.resolvedBy };
      if (resolution.status === "sku_not_listed") {
        await recordCheck(database, plan, "app_store", region.countryCode, "sku_not_listed", "公开内购列表未列出此套餐，不代表不能购买", evidenceUrl, verifiedAt, { ...details, evidence: listingEvidence });
        continue;
      }
      if (resolution.status === "ambiguous_sku" || !resolution.listing) {
        await recordCheck(database, plan, "app_store", region.countryCode, "ambiguous_sku", `同名内购项存在多个金额（${resolution.amounts.join(" / ")}），公开名称未区分周期或优惠资格；不把其中任何一项直接认作标准价`, evidenceUrl, verifiedAt, { ...details, evidence: listingEvidence });
        continue;
      }
      const listing = resolution.listing;
      const detectedCurrency = detectCurrencyFromDisplay(listing.displayAmount);
      if (detectedCurrency && detectedCurrency !== region.currency) {
        await recordCheck(database, plan, "app_store", region.countryCode, "currency_mismatch", `标价“${listing.displayAmount}”显示的币种为 ${detectedCurrency}，与商店目录的 ${region.currency} 不一致，未入库`, evidenceUrl, verifiedAt, { ...details, evidence: listingEvidence });
        continue;
      }
      const explicitPeriod = / - Monthly$/i.test(alias.rawPlanName) ? "month" : / - Annual$/i.test(alias.rawPlanName) ? "year" : null;
      const matchesVendorPage = webReference !== undefined && webReference.currency === region.currency && Math.abs(webReference.amount - listing.amount) < 0.005;
      // OpenAI documents monthly-only Go/Plus/Pro plans. This confirms the plan period,
      // not a logged-in customer's SKU eligibility, introductory offer or final charge.
      const monthlyOnly = target.vendor === "openai" && alias.planCode !== "chatgpt-plus-monthly";
      const billingPeriod = explicitPeriod ?? (monthlyOnly ? "month" : null);
      const billingEvidenceMethod = explicitPeriod ? "explicit_sku_name" : monthlyOnly ? "official_plan_document" : null;
      const billingEvidenceUrl = explicitPeriod ? evidenceUrl
        : monthlyOnly ? "https://help.openai.com/en/articles/11989085-what-is-chatgpt-go" : null;
      await upsertPrice(database, {
        vendor: target.vendor,
        planCode: alias.planCode,
        channel: "app_store",
        countryCode: region.countryCode,
        currency: region.currency,
        priceKind: "exact",
        amount: listing.amount,
        rawPlanName: alias.rawPlanName,
        appId: target.appId,
        evidenceUrl,
        evidence: {
          sourceOwner: "Apple App Store",
          publicListing: true,
          storefront: region.storefront,
          displayedAmount: listing.displayAmount,
          sourceKind: "public_store_listing",
          parser: parsed.parser,
          ...(resolution.amounts.length > 1 ? { listedAmounts: resolution.amounts, resolvedBy: resolution.resolvedBy } : {}),
          ...(resolution.duplicateOf.length ? { duplicateOf: resolution.duplicateOf } : {}),
          billingPeriod,
          ...(matchesVendorPage ? { vendorMonthlyMatch: { amount: webReference.amount, currency: webReference.currency, evidenceUrl: webReference.evidenceUrl }, matchIsBillingEvidence: false } : {}),
          ...(billingEvidenceUrl && billingEvidenceMethod ? { billingEvidenceUrl, billingEvidenceMethod } : {}),
          ...(target.vendor === "openai" ? { additionalBillingSources: ["https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", "https://chatgpt.com/plans/pro/"], checkoutVerified: false } : {}),
          taxTreatment: "checkout_required",
        },
      }, verifiedAt);
      const reason = explicitPeriod ? "官方内购名称明确标注周期；金额为公开标价，税费及购买资格仍需结算复核"
        : billingEvidenceMethod === "official_plan_document" ? "金额来自商店公开列表，标准套餐月付周期由 OpenAI 官方文档交叉确认；未核验具体账户结算及优惠资格"
        : "公开内购项未注明计费周期或优惠条件；仅保存标价，不作为已核验月费参与比较";
      await recordCheck(database, plan, "app_store", region.countryCode, billingPeriod ? "verified" : "billing_unverified", reason, evidenceUrl, verifiedAt, { ...details, evidence: listingEvidence });
      saved += 1;
    }
    return saved;
  });
  for (const region of storefronts) {
    const available = availableStorefronts.has(region.countryCode);
    await recordStorefront(database, "apple", region.countryCode, {
      storefront: region.storefront, currency: region.currency,
      status: available ? "available" : "unknown",
      detail: available ? null : "no_app_page_parsed",
    }, verifiedAt);
  }
  return { prices: results.reduce((total, count) => total + count, 0), storefronts: availableStorefronts.size, throttleRetries: gate.retries, throttleCooldownMs: gate.cooldownTotalMs };
}

// ---------------------------------------------------------------------------
// Google Play：仅公开区间
// ---------------------------------------------------------------------------

export interface GooglePlayCollectionResult {
  ranges: number;
  checks: number;
}

export async function collectGooglePlayRanges(database: Database, checkedAt = new Date()): Promise<GooglePlayCollectionResult> {
  const jobs = Object.entries(GOOGLE_PLAY_APPS).flatMap(([vendor, appId]) => OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map(region => ({ vendor, appId, region })));
  let ranges = 0;
  const gate = new SourceGate(800);
  const results = await mapWithConcurrency(jobs, 2, async ({ vendor, appId, region }) => {
    const url = `https://play.google.com/store/apps/details?id=${appId}&hl=en&gl=${region.countryCode}`;
    const plans = PLAN_SEEDS.filter(plan => plan.vendor === vendor);
    let status = "price_not_public";
    let reason = "Google Play 公开应用页不提供可归属到此套餐的内购 SKU 价格，需应用内结算核验";
    const details: CheckDetails = {};
    try {
      const page = await fetchPage(url, { gate, attempts: 3 });
      details.httpStatus = page.status;
      details.finalUrl = page.finalUrl;
      if (page.status !== 200) {
        status = "fetch_failed";
        reason = `来源访问失败：price_source_http_${page.status}`;
      } else {
        const range = parseGooglePlayInAppRange(page.text, region.currency);
        if (range) {
          status = "range_only";
          reason = `Google Play 仅公开应用内购买区间 ${range.lowerText} – ${range.upperText}，不能归属到具体套餐`;
          details.evidence = { lower: range.lower, upper: range.upper, lowerText: range.lowerText, upperText: range.upperText, currency: range.currency };
          ranges += 1;
        }
      }
    } catch (error) {
      status = "fetch_failed";
      reason = `来源访问失败：${errorMessage(error)}`;
    }
    for (const plan of plans) await recordCheck(database, plan, "google_play", region.countryCode, status, reason, url, checkedAt, details);
    return 1;
  });
  return { ranges, checks: results.reduce((sum, count) => sum + count, 0) };
}

// ---------------------------------------------------------------------------
// OpenAI 官网各国结算配置（需浏览器）
// ---------------------------------------------------------------------------

export interface OpenAiWebCollectionResult {
  prices: number;
  countries: number;
  notAvailable: number;
}

export function openAiCheckoutConfigUrl(countryCode: string): string {
  return `https://chatgpt.com/backend-anon/checkout_pricing_config/configs/${countryCode.toUpperCase()}`;
}

export async function collectOpenAiCheckoutConfigs(
  database: Database,
  verifiedAt = new Date(),
  options: { fetchDocuments: BrowserDocumentFetcher; scope?: RefreshScope; countries?: readonly string[]; batchSize?: number },
): Promise<OpenAiWebCollectionResult> {
  const openAiPlans = PLAN_SEEDS.filter((plan) => plan.vendor === "openai");
  const countries = options.countries
    ?? (options.scope === "featured" ? FEATURED_COUNTRY_CODES : await candidateCountries(database, "openai_web", OFFICIAL_COUNTRY_CANDIDATES, verifiedAt));
  const batchSize = Math.max(1, options.batchSize ?? 25);
  let prices = 0;
  let available = 0;
  let notAvailable = 0;
  for (let index = 0; index < countries.length; index += batchSize) {
    const batch = countries.slice(index, index + batchSize);
    const documents = await options.fetchDocuments(batch.map(openAiCheckoutConfigUrl));
    for (const [offset, countryCode] of batch.entries()) {
      const document = documents[offset];
      const url = openAiCheckoutConfigUrl(countryCode);
      const failAll = async (status: string, reason: string, details: CheckDetails = {}) => {
        for (const plan of openAiPlans) await recordCheck(database, plan, "web", countryCode, status, reason, url, verifiedAt, details);
      };
      if (!document || document.error || !document.text.trim()) {
        await failAll("fetch_failed", `来源访问失败：${document?.error ?? "empty_response"}`, { httpStatus: document?.status ?? null, finalUrl: document?.finalUrl ?? null });
        await recordStorefront(database, "openai_web", countryCode, { status: "unknown", detail: document?.error ?? "empty_response" }, verifiedAt);
        continue;
      }
      if (document.url !== url || document.finalUrl !== url || ![200, 404].includes(document.status ?? 0)) {
        await failAll("fetch_failed", `结算配置请求未成功或地址不匹配（HTTP ${document.status ?? "unknown"}）`, { httpStatus: document.status, finalUrl: document.finalUrl });
        continue;
      }
      const parsed = parseOpenAiCheckoutConfig(document.text);
      const details: CheckDetails = { httpStatus: document.status, finalUrl: document.finalUrl, parsedCount: parsed.prices.length };
      if (parsed.status === "not_found") {
        notAvailable += 1;
        await failAll("not_available", "OpenAI 官网没有该国家或地区的结算配置（Country config not found）", details);
        await recordStorefront(database, "openai_web", countryCode, { status: "not_available", detail: parsed.detail }, verifiedAt);
        continue;
      }
      if (parsed.status !== "ok" || !parsed.currency) {
        await failAll("parser_drift", `接口返回无法解析的内容（${document.text.replace(/\s+/g, " ").slice(0, 80)}），保留上一份记录`, details);
        await recordStorefront(database, "openai_web", countryCode, { status: "unknown", detail: "parser_drift" }, verifiedAt);
        continue;
      }
      if (parsed.countryCode !== countryCode.toUpperCase()) {
        await failAll("country_fallback", `接口回显的国家为 ${parsed.countryCode}，未采集`, details);
        continue;
      }
      available += 1;
      await recordStorefront(database, "openai_web", countryCode, { currency: parsed.currency, status: "available" }, verifiedAt);
      const commonEvidence = {
        sourceOwner: "OpenAI",
        sourceKind: "official_checkout_config",
        taxType: parsed.taxType,
        ...(parsed.taxPercent !== null ? { taxPercent: parsed.taxPercent } : {}),
        rolloutGate: parsed.rolloutGate,
        rolloutGated: parsed.rolloutGate !== null,
        promoNames: Object.keys(parsed.promos),
        ...(parsed.unknownKeys.length ? { unknownConfigKeys: parsed.unknownKeys } : {}),
        ...(parsed.plusAnnualMonthlyEquivalent ? { plusAnnualMonthlyEquivalent: parsed.plusAnnualMonthlyEquivalent } : {}),
      };
      for (const plan of openAiPlans) {
        const price = parsed.prices.find((item) => item.planCode === plan.planCode);
        if (!price) {
          await recordCheck(database, plan, "web", countryCode, "price_not_public", "该国结算配置没有此套餐", url, verifiedAt, details);
          continue;
        }
        await upsertPrice(database, {
          vendor: plan.vendor,
          planCode: plan.planCode,
          channel: "web",
          countryCode,
          currency: parsed.currency,
          priceKind: "exact",
          amount: price.amount,
          rawPlanName: price.configKey,
          evidenceUrl: url,
          evidence: {
            ...commonEvidence,
            configKey: price.configKey,
            billingPeriod: "month",
            billingEvidenceUrl: url,
            billingEvidenceMethod: "official_checkout_config_interval",
            taxTreatment: price.tax ?? "unknown",
            ...(price.pspOverride ? { pspOverride: price.pspOverride } : {}),
          },
        }, verifiedAt);
        prices += 1;
        await recordCheck(database, plan, "web", countryCode, "verified",
          `已从 OpenAI 官网结算配置读取该国月价（${price.tax === "inclusive" ? "含税" : price.tax === "exclusive" ? "不含税" : "税费口径未知"}${parsed.rolloutGate ? "，本币定价处于灰度" : ""}）；实际结算按付款方式所属国家`,
          url, verifiedAt, { ...details, evidence: { configKey: price.configKey, tax: price.tax, rolloutGate: parsed.rolloutGate } });
      }
      if (parsed.unknownKeys.length) {
        await recordCheck(database, { vendor: "openai", planCode: "config_schema" }, "web", countryCode, "schema_change", `结算配置出现未知键：${parsed.unknownKeys.join(", ")}`, url, verifiedAt, details);
      }
    }
  }
  return { prices, countries: available, notAvailable };
}

// ---------------------------------------------------------------------------
// 汇率与总入口
// ---------------------------------------------------------------------------

export async function refreshEcbCnyRates(database: Database): Promise<number> {
  const currencies = [...new Set([
    "CNY",
    ...APPLE_STOREFRONT_CATALOG.map((item) => item.currency),
    ...OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map((region) => region.currency),
  ])].filter((currency) => currency !== "EUR" && (currency === "CNY" || ECB_REFERENCE_CURRENCIES.has(currency))).sort();
  const startYear = new Date().getUTCFullYear() - 1;
  const sourceUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currencies.join("+")}.EUR.SP00.A?format=csvdata&startPeriod=${startYear}-01-01`;
  const csv = await fetchText(sourceUrl);
  const rows = parseEcbCnyRates(csv).map(row => ({
    baseCurrency: row.currency, quoteCurrency: "CNY" as const,
    rate: row.rate, effectiveDate: row.effectiveDate,
  }));
  if (!rows.length) throw new Error("ecb_current_cny_missing");
  for (const row of rows) {
    await database.insert(exchangeRateSnapshots).values({
      ...row,
      rate: row.rate.toFixed(10),
      sourceUrl,
      sourceName: "European Central Bank reference rates",
    }).onConflictDoUpdate({
      target: [exchangeRateSnapshots.baseCurrency, exchangeRateSnapshots.quoteCurrency, exchangeRateSnapshots.effectiveDate],
      set: { rate: row.rate.toFixed(10), sourceUrl, sourceName: "European Central Bank reference rates", capturedAt: new Date() },
    });
  }
  return rows.length;
}

export async function refreshOfficialSubscriptionChannels(
  database: Database,
  options: SubscriptionRefreshOptions = {},
): Promise<SubscriptionRefreshResult> {
  resetRunCaches();
  const scope = options.scope ?? "full";
  const verifiedAt = new Date();
  const report = (source: string, error: unknown) => options.onError?.(source, error);
  let exchangeRates = 0;
  try { exchangeRates = await refreshEcbCnyRates(database); } catch (error) { report("ecb", error); }
  const seededPrices = await seedVerifiedSubscriptionPrices(database);
  const verifiedWebPrices = await verifyOfficialWebPrices(database, verifiedAt);
  let google: GoogleWebCollectionResult = { prices: 0, countries: 0, monthlyAmounts: new Map() };
  try { google = await collectGoogleWebPrices(database, verifiedAt, { scope }); } catch (error) { report("google_web", error); }
  let apple: AppleCollectionResult = { prices: 0, storefronts: 0, throttleRetries: 0, throttleCooldownMs: 0 };
  try { apple = await collectAppleAppStorePrices(database, verifiedAt, { scope, googleWebMonthlyAmounts: google.monthlyAmounts }); } catch (error) { report("apple", error); }
  let play: GooglePlayCollectionResult = { ranges: 0, checks: 0 };
  try { play = await collectGooglePlayRanges(database, verifiedAt); } catch (error) { report("google_play", error); }
  let openAi: OpenAiWebCollectionResult = { prices: 0, countries: 0, notAvailable: 0 };
  let openAiSkipped = true;
  if (options.fetchDocuments) {
    try {
      openAi = await collectOpenAiCheckoutConfigs(database, verifiedAt, { fetchDocuments: options.fetchDocuments, scope });
      openAiSkipped = false;
    } catch (error) { report("openai_web", error); }
  }
  return {
    scope,
    exchangeRates,
    seededPrices,
    verifiedWebPrices,
    appStorePrices: apple.prices,
    appStoreStorefronts: apple.storefronts,
    appStoreThrottleRetries: apple.throttleRetries,
    appStoreThrottleCooldownMs: apple.throttleCooldownMs,
    googleWebPrices: google.prices,
    googleWebCountries: google.countries,
    googlePlayRanges: play.ranges,
    googlePlayChecks: play.checks,
    openAiWebPrices: openAi.prices,
    openAiWebCountries: openAi.countries,
    openAiWebSkipped: openAiSkipped,
  };
}
