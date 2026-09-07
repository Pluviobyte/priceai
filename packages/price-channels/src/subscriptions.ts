import { createHash } from "node:crypto";
import {
  exchangeRateSnapshots,
  canonicalProducts,
  officialSubscriptionPlans,
  officialSubscriptionPriceHistory,
  officialSubscriptionPrices,
} from "@price-radar/database/schema";
import * as databaseSchema from "@price-radar/database/schema";
import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  OFFICIAL_SUBSCRIPTION_PLAN_CATALOG,
  OFFICIAL_SUBSCRIPTION_REGION_CATALOG,
  type OfficialSubscriptionPlanCatalogItem,
} from "@price-radar/price-channels/subscription-catalog";
import { extractChatGptGoWebPrice, extractOfficialPagePrice, parseAppStorePriceListings, selectAppStorePlanPrice } from "@price-radar/price-channels/storefront-parser";

type Database = NodePgDatabase<typeof databaseSchema>;

type PriceKind = "exact" | "range" | "unknown";
type Channel = "web" | "app_store" | "google_play";

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

export interface SubscriptionRefreshResult {
  exchangeRates: number;
  seededPrices: number;
  verifiedWebPrices: number;
  appStorePrices: number;
  googlePlayRanges: number;
}

const PLAN_SEEDS = OFFICIAL_SUBSCRIPTION_PLAN_CATALOG;

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
  { vendor: "anthropic", planCode: "claude-pro-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 20, rawPlanName: "Pro", evidenceUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan", verificationTerms: ["Pro"] },
  { vendor: "anthropic", planCode: "claude-pro-annual", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Pro annual", evidenceUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan", evidence: { billedUpfront: true } },
  { vendor: "anthropic", planCode: "claude-max-5x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "Max 5x", evidenceUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan", evidence: { usageMultiple: 5 }, verificationTerms: ["Max 5x", "Claude"] },
  { vendor: "anthropic", planCode: "claude-max-20x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Max 20x", evidenceUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan", evidence: { usageMultiple: 20 }, verificationTerms: ["Max 20x", "Claude"] },
  { vendor: "xai", planCode: "supergrok-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 30, rawPlanName: "SuperGrok", evidenceUrl: "https://x.ai/pricing" },
  { vendor: "xai", planCode: "supergrok-plus-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "SuperGrok Plus", evidenceUrl: "https://x.ai/pricing" },
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

const APP_STORE_TARGETS = [
  {
    appId: "6448311069",
    vendor: "openai",
    aliases: [
      { rawPlanName: "ChatGPT Go", planCode: "chatgpt-go-monthly", selection: "lowest" },
      { rawPlanName: "ChatGPT Plus", planCode: "chatgpt-plus-monthly", selection: "lowest", mustBeLessThanPlanName: "ChatGPT Pro 5x" },
      { rawPlanName: "ChatGPT Pro 5x", planCode: "chatgpt-pro-5x-monthly", selection: "lowest" },
      { rawPlanName: "ChatGPT Pro 20x", planCode: "chatgpt-pro-20x-monthly", selection: "lowest" },
    ],
  },
  {
    appId: "6473753684",
    vendor: "anthropic",
    aliases: [
      { rawPlanName: "Claude Pro - Monthly", planCode: "claude-pro-monthly", selection: "first" },
      { rawPlanName: "Claude Pro - Annual", planCode: "claude-pro-annual", selection: "first" },
      { rawPlanName: "Claude Max 5x - Monthly", planCode: "claude-max-5x-monthly", selection: "first" },
      { rawPlanName: "Claude Max 20x - Monthly", planCode: "claude-max-20x-monthly", selection: "first" },
    ],
  },
  {
    appId: "6477489729",
    vendor: "google",
    aliases: [
      { rawPlanName: "Google AI Plus (400 GB)", planCode: "google-ai-plus-monthly", selection: "lowest" },
      { rawPlanName: "Google AI Pro (5 TB)", planCode: "google-ai-pro-monthly", selection: "lowest" },
      { rawPlanName: "Google AI Ultra (30 TB)", planCode: "google-ai-ultra-monthly", selection: "lowest" },
    ],
  },
  {
    appId: "6670324846",
    vendor: "xai",
    aliases: [
      { rawPlanName: "SuperGrok", planCode: "supergrok-monthly", selection: "lowest" },
      { rawPlanName: "SuperGrok Plus", planCode: "supergrok-plus-monthly", selection: "lowest" },
    ],
  },
] as const;

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

async function upsertPlan(database: Database, seed: OfficialSubscriptionPlanCatalogItem): Promise<string> {
  const canonicalSlug = CANONICAL_SLUG_BY_PLAN[`${seed.vendor}:${seed.planCode}`];
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
  return row.id;
}

async function latestCnyRate(database: Database, currency: string) {
  if (currency === "CNY") return { id: null, rate: 1 };
  const [row] = await database
    .select({ id: exchangeRateSnapshots.id, rate: exchangeRateSnapshots.rate })
    .from(exchangeRateSnapshots)
    .where(and(eq(exchangeRateSnapshots.baseCurrency, currency), eq(exchangeRateSnapshots.quoteCurrency, "CNY")))
    .orderBy(desc(exchangeRateSnapshots.effectiveDate))
    .limit(1);
  return row ? { id: row.id, rate: Number(row.rate) } : null;
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
  // These values were manually checked from official pages; hourly jobs must not make them appear newly fetched.
  const verifiedAt = new Date("2026-09-04T00:00:00.000Z");
  for (const plan of PLAN_SEEDS) await upsertPlan(database, plan);
  for (const price of VERIFIED_WEB_PRICES) {
    await upsertPrice(database, price, verifiedAt, { preserveVerifiedAtWhenUnchanged: true });
  }
  await upsertPrice(database, GO_ANNOUNCEMENT_PRICE, new Date("2026-01-16T00:00:00.000Z"), { preserveVerifiedAtWhenUnchanged: true });
  return VERIFIED_WEB_PRICES.length + 1;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(8_000),
    headers: { "user-agent": "AIPriceRadar/0.1 (+public-price-verification)" },
  });
  if (!response.ok) throw new Error(`price_source_http_${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("price_source_too_large");
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error("price_source_too_large");
  return text;
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
  const sourceUrls = [...new Set(LIVE_WEB_PRICES.map((price) => price.evidenceUrl))];
  const fetchedPages = await mapWithConcurrency(sourceUrls, 4, async (sourceUrl) => {
    try {
      return [sourceUrl, await fetchText(sourceUrl)] as const;
    } catch {
      return [sourceUrl, null] as const;
    }
  });
  const pageByUrl = new Map<string, string | null>(fetchedPages);
  let verified = 0;
  for (const price of LIVE_WEB_PRICES) {
    const html = pageByUrl.get(price.evidenceUrl);
    if (!html || price.amount === undefined || !price.verificationTerms) continue;
    const extractedAmount = price.planCode === "chatgpt-go-monthly" ? extractChatGptGoWebPrice(html) : extractOfficialPagePrice(html, price.verificationTerms);
    if (extractedAmount === null || extractedAmount < price.amount * 0.25 || extractedAmount > price.amount * 4) continue;
    await upsertPrice(database, {
      ...price,
      amount: extractedAmount,
      evidence: { ...(price.evidence ?? {}), publicPageParsed: true },
    }, verifiedAt);
    verified += 1;
  }
  return verified;
}

export async function collectAppleAppStorePrices(database: Database, verifiedAt = new Date()): Promise<number> {
  const jobs = APP_STORE_TARGETS.flatMap((target) =>
    OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map((region) => ({ target, region })),
  );
  const results = await mapWithConcurrency(jobs, 12, async ({ target, region }) => {
    const evidenceUrl = `https://apps.apple.com/${region.storefront}/app/id${target.appId}`;
    try {
      const listings = parseAppStorePriceListings(await fetchText(evidenceUrl), region.currency);
      let saved = 0;
      for (const alias of target.aliases) {
        const listing = selectAppStorePlanPrice(
          listings,
          alias.rawPlanName,
          alias.selection,
          "mustBeLessThanPlanName" in alias ? { mustBeLessThanPlanName: alias.mustBeLessThanPlanName } : {},
        );
        if (!listing) continue;
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
          },
        }, verifiedAt);
        saved += 1;
      }
      return saved;
    } catch {
      return 0;
    }
  });
  return results.reduce((total, count) => total + count, 0);
}

function parseEcbCsv(csv: string): Map<string, { date: string; rate: number }> {
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0]?.split(",").map((item) => item.replace(/^"|"$/g, "")) ?? [];
  const currencyIndex = headers.indexOf("CURRENCY");
  const dateIndex = headers.indexOf("TIME_PERIOD");
  const valueIndex = headers.indexOf("OBS_VALUE");
  if (currencyIndex < 0 || dateIndex < 0 || valueIndex < 0) throw new Error("ecb_csv_shape_changed");
  const latest = new Map<string, { date: string; rate: number }>();
  for (const line of lines.slice(1)) {
    const columns = line.split(",").map((item) => item.replace(/^"|"$/g, ""));
    const currency = columns[currencyIndex];
    const date = columns[dateIndex];
    const rate = Number(columns[valueIndex]);
    if (!currency || !date || !Number.isFinite(rate)) continue;
    const previous = latest.get(currency);
    if (!previous || date > previous.date) latest.set(currency, { date, rate });
  }
  return latest;
}

export async function refreshEcbCnyRates(database: Database): Promise<number> {
  const currencies = [...new Set([
    "CNY",
    ...OFFICIAL_SUBSCRIPTION_REGION_CATALOG
      .map((region) => region.currency)
      .filter((currency) => currency !== "EUR" && currency !== "TWD"),
  ])];
  const startYear = new Date().getUTCFullYear() - 1;
  const sourceUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currencies.join("+")}.EUR.SP00.A?format=csvdata&startPeriod=${startYear}-01-01`;
  const csv = await fetchText(sourceUrl);
  const values = parseEcbCsv(csv);
  const cny = values.get("CNY");
  if (!cny) throw new Error("ecb_cny_missing");
  const rows: Array<{ baseCurrency: string; quoteCurrency: "CNY"; rate: number; effectiveDate: string }> = [
    { baseCurrency: "EUR", quoteCurrency: "CNY", rate: cny.rate, effectiveDate: cny.date },
  ];
  for (const currency of currencies) {
    if (currency === "CNY") continue;
    const value = values.get(currency);
    if (!value) continue;
    rows.push({
      baseCurrency: currency,
      quoteCurrency: "CNY",
      rate: cny.rate / value.rate,
      effectiveDate: cny.date < value.date ? cny.date : value.date,
    });
  }
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

export async function refreshOfficialSubscriptionChannels(database: Database): Promise<SubscriptionRefreshResult> {
  const verifiedAt = new Date();
  let exchangeRates = 0;
  try { exchangeRates = await refreshEcbCnyRates(database); } catch { /* keep native prices when ECB is unavailable */ }
  const seededPrices = await seedVerifiedSubscriptionPrices(database);
  const verifiedWebPrices = await verifyOfficialWebPrices(database, verifiedAt);
  let appStorePrices = 0;
  try { appStorePrices = await collectAppleAppStorePrices(database, verifiedAt); } catch { /* one source outage must not erase current values */ }
  return { exchangeRates, seededPrices, verifiedWebPrices, appStorePrices, googlePlayRanges: 0 };
}
