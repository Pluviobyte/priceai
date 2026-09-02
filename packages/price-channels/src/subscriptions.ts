import { createHash } from "node:crypto";
import {
  exchangeRateSnapshots,
  canonicalProducts,
  officialSubscriptionPlans,
  officialSubscriptionPriceHistory,
  officialSubscriptionPrices,
  type Database,
} from "@price-radar/database";
import { and, desc, eq } from "drizzle-orm";

type PriceKind = "exact" | "range" | "unknown";
type Channel = "web" | "app_store" | "google_play";

interface PlanSeed {
  vendor: string;
  planCode: string;
  displayName: string;
  billingPeriod: "month" | "year" | "one_time";
  officialUrl: string;
}

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
}

export interface SubscriptionRefreshResult {
  exchangeRates: number;
  seededPrices: number;
  appStorePrices: number;
  googlePlayRanges: number;
}

const PLAN_SEEDS: readonly PlanSeed[] = [
  { vendor: "openai", planCode: "chatgpt-plus-monthly", displayName: "ChatGPT Plus", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus" },
  { vendor: "openai", planCode: "chatgpt-pro-5x-monthly", displayName: "ChatGPT Pro 5x", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro" },
  { vendor: "openai", planCode: "chatgpt-pro-20x-monthly", displayName: "ChatGPT Pro 20x", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro" },
  { vendor: "anthropic", planCode: "claude-pro-monthly", displayName: "Claude Pro", billingPeriod: "month", officialUrl: "https://support.anthropic.com/en/articles/8325610-how-much-does-claude-pro-cost" },
  { vendor: "anthropic", planCode: "claude-pro-annual", displayName: "Claude Pro Annual", billingPeriod: "year", officialUrl: "https://support.anthropic.com/en/articles/8325610-how-much-does-claude-pro-cost" },
  { vendor: "anthropic", planCode: "claude-max-5x-monthly", displayName: "Claude Max 5x", billingPeriod: "month", officialUrl: "https://support.anthropic.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "anthropic", planCode: "claude-max-20x-monthly", displayName: "Claude Max 20x", billingPeriod: "month", officialUrl: "https://support.anthropic.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "xai", planCode: "supergrok-monthly", displayName: "SuperGrok", billingPeriod: "month", officialUrl: "https://x.ai/pricing" },
  { vendor: "xai", planCode: "supergrok-plus-monthly", displayName: "SuperGrok Plus", billingPeriod: "month", officialUrl: "https://x.ai/pricing" },
];

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
  { vendor: "openai", planCode: "chatgpt-plus-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 20, rawPlanName: "ChatGPT Plus", evidenceUrl: "https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus", evidence: { billing: "monthly", officialArticleUpdated: "2026-08-17" } },
  { vendor: "openai", planCode: "chatgpt-pro-5x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "Pro $100 (5x)", evidenceUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", evidence: { usageMultiple: 5, officialArticleUpdated: "2026-08-26" } },
  { vendor: "openai", planCode: "chatgpt-pro-20x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Pro $200 (20x)", evidenceUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", evidence: { usageMultiple: 20, officialArticleUpdated: "2026-08-26" } },
  { vendor: "anthropic", planCode: "claude-pro-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 20, rawPlanName: "Pro", evidenceUrl: "https://support.anthropic.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "anthropic", planCode: "claude-pro-annual", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Pro annual", evidenceUrl: "https://support.anthropic.com/en/articles/8325610-how-much-does-claude-pro-cost", evidence: { billedUpfront: true } },
  { vendor: "anthropic", planCode: "claude-max-5x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "Max 5x", evidenceUrl: "https://support.anthropic.com/en/articles/11049762-choosing-a-claude-ai-plan", evidence: { usageMultiple: 5 } },
  { vendor: "anthropic", planCode: "claude-max-20x-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 200, rawPlanName: "Max 20x", evidenceUrl: "https://support.anthropic.com/en/articles/11049762-choosing-a-claude-ai-plan", evidence: { usageMultiple: 20 } },
  { vendor: "xai", planCode: "supergrok-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 30, rawPlanName: "SuperGrok", evidenceUrl: "https://x.ai/pricing" },
  { vendor: "xai", planCode: "supergrok-plus-monthly", channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: 100, rawPlanName: "SuperGrok Plus", evidenceUrl: "https://x.ai/pricing" },
];

const APP_STORE_TARGETS = [
  {
    appId: "6448311069",
    countryCode: "US",
    currency: "USD",
    vendor: "openai",
    aliases: [
      ["ChatGPT Plus", "chatgpt-plus-monthly"],
      ["ChatGPT Pro 5x", "chatgpt-pro-5x-monthly"],
      ["ChatGPT Pro 20x", "chatgpt-pro-20x-monthly"],
    ],
  },
  {
    appId: "6473753684",
    countryCode: "US",
    currency: "USD",
    vendor: "anthropic",
    aliases: [
      ["Claude Pro - Monthly", "claude-pro-monthly"],
      ["Claude Pro - Annual", "claude-pro-annual"],
      ["Claude Max 5x - Monthly", "claude-max-5x-monthly"],
      ["Claude Max 20x - Monthly", "claude-max-20x-monthly"],
    ],
  },
] as const;

const GOOGLE_PLAY_TARGETS = [
  { packageId: "com.openai.chatgpt", vendor: "openai", planCode: "chatgpt-plus-monthly", countryCode: "US", currency: "USD" },
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

async function upsertPlan(database: Database, seed: PlanSeed): Promise<string> {
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

async function upsertPrice(database: Database, seed: PriceSeed, verifiedAt: Date): Promise<void> {
  const plan = PLAN_SEEDS.find((item) => item.vendor === seed.vendor && item.planCode === seed.planCode);
  if (!plan) throw new Error(`unknown_official_plan:${seed.vendor}:${seed.planCode}`);
  const planId = await upsertPlan(database, plan);
  const rate = await latestCnyRate(database, seed.currency);
  const cnyEstimate = seed.amount !== undefined && rate ? seed.amount * rate.rate : undefined;
  const evidence = { ...(seed.evidence ?? {}), priceKind: seed.priceKind };
  const evidenceHash = hashEvidence({ ...seed, evidence });
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
  const changed = !existing || existing.evidenceHash !== evidenceHash;
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
      cnyEstimate: numberString(cnyEstimate),
      exchangeRateSnapshotId: rate?.id ?? null,
      rawPlanName: seed.rawPlanName,
      appId: seed.appId ?? null,
      evidenceUrl: seed.evidenceUrl,
      evidence,
      evidenceHash,
      verifiedAt,
    })
    .onConflictDoUpdate({
      target: [officialSubscriptionPrices.planId, officialSubscriptionPrices.channel, officialSubscriptionPrices.countryCode, officialSubscriptionPrices.rawPlanName],
      set: {
        currency: seed.currency,
        priceKind: seed.priceKind,
        amount: numberString(seed.amount),
        lowerAmount: numberString(seed.lowerAmount),
        upperAmount: numberString(seed.upperAmount),
        cnyEstimate: numberString(cnyEstimate),
        exchangeRateSnapshotId: rate?.id ?? null,
        appId: seed.appId ?? null,
        evidenceUrl: seed.evidenceUrl,
        evidence,
        evidenceHash,
        verifiedAt,
        updatedAt: verifiedAt,
      },
    })
    .returning({ id: officialSubscriptionPrices.id });
  if (!price) throw new Error("official_subscription_price_upsert_failed");
  if (changed) {
    await database.insert(officialSubscriptionPriceHistory).values({
      officialPriceId: price.id,
      currency: seed.currency,
      priceKind: seed.priceKind,
      amount: numberString(seed.amount),
      lowerAmount: numberString(seed.lowerAmount),
      upperAmount: numberString(seed.upperAmount),
      cnyEstimate: numberString(cnyEstimate),
      evidenceUrl: seed.evidenceUrl,
      evidenceHash,
      observedAt: verifiedAt,
    });
  }
}

export async function seedVerifiedSubscriptionPrices(database: Database, verifiedAt = new Date()): Promise<number> {
  for (const plan of PLAN_SEEDS) await upsertPlan(database, plan);
  for (const price of VERIFIED_WEB_PRICES) await upsertPrice(database, price, verifiedAt);
  return VERIFIED_WEB_PRICES.length;
}

function decodeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;|&#47;/g, "/")
    .replace(/\s+/g, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: { "user-agent": "AIPriceRadar/0.1 (+public-price-verification)" },
  });
  if (!response.ok) throw new Error(`price_source_http_${response.status}`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("price_source_too_large");
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error("price_source_too_large");
  return text;
}

export async function collectAppleAppStorePrices(database: Database, verifiedAt = new Date()): Promise<number> {
  let saved = 0;
  for (const target of APP_STORE_TARGETS) {
    const evidenceUrl = `https://apps.apple.com/${target.countryCode.toLowerCase()}/app/id${target.appId}`;
    const text = decodeHtml(await fetchText(evidenceUrl));
    for (const [rawPlanName, planCode] of target.aliases) {
      const expression = new RegExp(`${escapeRegex(rawPlanName)}\\s+\\$([0-9]+(?:\\.[0-9]{1,2})?)`, "i");
      const match = text.match(expression);
      if (!match?.[1]) continue;
      await upsertPrice(database, {
        vendor: target.vendor,
        planCode,
        channel: "app_store",
        countryCode: target.countryCode,
        currency: target.currency,
        priceKind: "exact",
        amount: Number(match[1]),
        rawPlanName,
        appId: target.appId,
        evidenceUrl,
        evidence: { sourceOwner: "Apple App Store", publicListing: true },
      }, verifiedAt);
      saved += 1;
    }
  }
  return saved;
}

export async function collectGooglePlayRanges(database: Database, verifiedAt = new Date()): Promise<number> {
  let saved = 0;
  for (const target of GOOGLE_PLAY_TARGETS) {
    const evidenceUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(target.packageId)}&hl=en_US&gl=US`;
    const raw = await fetchText(evidenceUrl);
    const text = decodeHtml(raw.replace(/\\u0026/g, "&"));
    const range = text.match(/\$([0-9]+(?:\.[0-9]{1,2})?)\s*(?:[-–—]|to)\s*\$([0-9]+(?:\.[0-9]{1,2})?)[^$]{0,40}(?:item|purchase)/i);
    await upsertPrice(database, {
      vendor: target.vendor,
      planCode: target.planCode,
      channel: "google_play",
      countryCode: target.countryCode,
      currency: target.currency,
      priceKind: range?.[1] && range[2] ? "range" : "unknown",
      ...(range?.[1] ? { lowerAmount: Number(range[1]) } : {}),
      ...(range?.[2] ? { upperAmount: Number(range[2]) } : {}),
      rawPlanName: "Google Play public in-app purchase range",
      appId: target.packageId,
      evidenceUrl,
      evidence: { sourceOwner: "Google Play", exactSkuPrice: false, listingSaysInAppPurchases: /in-app purchases/i.test(text) },
    }, verifiedAt);
    saved += 1;
  }
  return saved;
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
  const sourceUrl = "https://data-api.ecb.europa.eu/service/data/EXR/D.CNY+USD.EUR.SP00.A?format=csvdata&startPeriod=2026-01-01";
  const csv = await fetchText(sourceUrl);
  const values = parseEcbCsv(csv);
  const cny = values.get("CNY");
  const usd = values.get("USD");
  if (!cny || !usd) throw new Error("ecb_cny_or_usd_missing");
  const rows = [
    { baseCurrency: "EUR", quoteCurrency: "CNY", rate: cny.rate, effectiveDate: cny.date },
    { baseCurrency: "USD", quoteCurrency: "CNY", rate: cny.rate / usd.rate, effectiveDate: cny.date < usd.date ? cny.date : usd.date },
  ];
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
  const seededPrices = await seedVerifiedSubscriptionPrices(database, verifiedAt);
  let appStorePrices = 0;
  let googlePlayRanges = 0;
  try { appStorePrices = await collectAppleAppStorePrices(database, verifiedAt); } catch { /* one source outage must not erase current values */ }
  try { googlePlayRanges = await collectGooglePlayRanges(database, verifiedAt); } catch { /* preserve the last verified observation */ }
  return { exchangeRates, seededPrices, appStorePrices, googlePlayRanges };
}
