import { parseEcbCnyRates } from "@price-radar/price-channels/exchange-rates";
import { createHash } from "node:crypto";
import {
  exchangeRateSnapshots,
  canonicalProducts,
  officialSubscriptionPlans,
  officialSubscriptionPriceHistory,
  officialSubscriptionPrices,
  officialSubscriptionChecks,
} from "@price-radar/database/schema";
import * as databaseSchema from "@price-radar/database/schema";
import { and, desc, eq, gte, lte, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  OFFICIAL_SUBSCRIPTION_PLAN_CATALOG,
  OFFICIAL_SUBSCRIPTION_REGION_CATALOG,
  type OfficialSubscriptionPlanCatalogItem,
} from "@price-radar/price-channels/subscription-catalog";
import { extractChatGptGoWebPrice, extractClaudePlanPrice, hasAmbiguousAppStorePrices, extractOfficialPagePrice, parseAppStorePriceListings, selectAppStorePlanPrice } from "@price-radar/price-channels/storefront-parser";

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
  googlePlayChecks: number;
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
    .where(and(eq(exchangeRateSnapshots.baseCurrency, currency), eq(exchangeRateSnapshots.quoteCurrency, "CNY"),
      lte(exchangeRateSnapshots.effectiveDate, new Date().toISOString().slice(0, 10)),
      gte(exchangeRateSnapshots.effectiveDate, new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)),
      gt(exchangeRateSnapshots.rate, "0")))
    .orderBy(desc(exchangeRateSnapshots.effectiveDate))
    .limit(1);
  return row && Number.isFinite(Number(row.rate)) ? { id: row.id, rate: Number(row.rate) } : null;
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
  // Explicit manual source review on 2026-09-07; scheduled refreshes keep this fixed timestamp.
  const reviewedAt = new Date("2026-09-07T09:04:00.000Z");
  for (const price of VERIFIED_WEB_PRICES) {
    const plan = PLAN_SEEDS.find(plan => plan.planCode === price.planCode)!;
    await upsertPrice(database, { ...price, evidence: { ...price.evidence, sourceKind: "official_public_price", billingPeriod: plan.billingPeriod, billingEvidenceUrl: price.evidenceUrl, taxTreatment: "checkout_required", verificationMethod: "official_document_manual_review", reviewDocument: "docs/research/official-subscription-verification-2026-09-07.md" } }, reviewedAt, { preserveVerifiedAtWhenUnchanged: true });
  }
  return VERIFIED_WEB_PRICES.length + 1;
}

async function recordCheck(database: Database, plan: { vendor: string; planCode: string }, channel: Channel, countryCode: string, status: string, reason: string, evidenceUrl: string, checkedAt: Date): Promise<void> {
  const values = { vendor: plan.vendor, planCode: plan.planCode, channel, countryCode, status, reason, evidenceUrl, checkedAt };
  await database.insert(officialSubscriptionChecks).values(values).onConflictDoUpdate({
    target: [officialSubscriptionChecks.vendor, officialSubscriptionChecks.planCode, officialSubscriptionChecks.channel, officialSubscriptionChecks.countryCode], set: values,
  });
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
  const sourceUrls = [...new Set([...LIVE_WEB_PRICES.map(price => price.evidenceUrl), ...PLAN_SEEDS.filter(plan => plan.vendor === "google").map(plan => plan.officialUrl)])];
  const fetchedPages = await mapWithConcurrency(sourceUrls, 4, async sourceUrl => {
    try { return [sourceUrl, { html: await fetchText(sourceUrl), error: "" }] as const; }
    catch (error) { return [sourceUrl, { html: null, error: error instanceof Error ? error.message : "fetch_failed" }] as const; }
  });
  const pages = new Map<string, { html: string | null; error: string }>(fetchedPages);
  let verified = 0;
  for (const plan of PLAN_SEEDS) {
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
      const status = !page?.html ? "fetch_failed" : region.countryCode !== "US" ? "regional_checkout_required" : amount !== null ? "verified" : "price_not_public";
      const reason = status === "fetch_failed" ? `来源访问失败：${page?.error ?? "fetch_failed"}`
        : status === "regional_checkout_required" ? "公开参考页未提供该地区的结算价，需地区账户或结算页核验"
        : status === "verified" ? "已从官方页面解析套餐价格" : "公开页未提供能对应此套餐、币种与周期的精确价格";
      await recordCheck(database, plan, "web", region.countryCode, status, reason, url, verifiedAt);
    }
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
        const ambiguous = hasAmbiguousAppStorePrices(listings, alias.rawPlanName);
        if (ambiguous) {
          await recordCheck(database, { vendor: target.vendor, planCode: alias.planCode }, "app_store", region.countryCode, "ambiguous_sku", "同名内购项存在多个金额，公开名称未区分周期或优惠资格；不将最便宜的一项直接认作标准月价", evidenceUrl, verifiedAt);
          continue;
        }
        const listing = selectAppStorePlanPrice(
          listings,
          alias.rawPlanName,
          alias.selection,
          "mustBeLessThanPlanName" in alias ? { mustBeLessThanPlanName: alias.mustBeLessThanPlanName } : {},
        );
        if (!listing) {
          const hasAlias = listings.some(item => item.rawPlanName === alias.rawPlanName);
          await recordCheck(database, { vendor: target.vendor, planCode: alias.planCode }, "app_store", region.countryCode,
            hasAlias ? "ambiguous_sku" : "sku_not_listed", hasAlias ? "公开内购项无法可靠对应月付套餐，保留历史价格待核验" : "公开内购列表未列出此套餐，不代表不能购买", evidenceUrl, verifiedAt);
          continue;
        }
        const explicitPeriod = / - Monthly$/i.test(alias.rawPlanName) ? "month" : / - Annual$/i.test(alias.rawPlanName) ? "year" : null;
        // OpenAI documents monthly-only Go/Plus/Pro plans. This confirms the plan period,
        // not a logged-in customer's SKU eligibility, introductory offer or final charge.
        const billingPeriod = explicitPeriod ?? (target.vendor === "openai" ? "month" : null);
        const billingEvidenceUrl = explicitPeriod ? evidenceUrl : target.vendor === "openai"
          ? "https://help.openai.com/en/articles/11989085-what-is-chatgpt-go" : null;
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
            billingPeriod,
            ...(billingEvidenceUrl ? { billingEvidenceUrl, billingEvidenceMethod: explicitPeriod ? "explicit_sku_name" : "official_plan_document" } : {}),
            ...(target.vendor === "openai" ? { additionalBillingSources: ["https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro", "https://chatgpt.com/plans/pro/"], checkoutVerified: false } : {}),
            taxTreatment: "checkout_required",
          },
        }, verifiedAt);
        await recordCheck(database, { vendor: target.vendor, planCode: alias.planCode }, "app_store", region.countryCode,
          billingPeriod ? "verified" : "billing_unverified",
          explicitPeriod ? "官方内购名称明确标注周期；金额为公开标价，税费及购买资格仍需结算复核" : billingPeriod ? "金额来自商店公开列表，标准套餐月付周期由 OpenAI 官方文档交叉确认；未核验具体账户结算及优惠资格" : "公开内购项未注明计费周期或优惠条件；仅保存标价，不作为已核验月费参与比较", evidenceUrl, verifiedAt);
        saved += 1;
      }
      return saved;
    } catch (error) {
      for (const alias of target.aliases) await recordCheck(database, { vendor: target.vendor, planCode: alias.planCode }, "app_store", region.countryCode, "fetch_failed", `来源访问失败：${error instanceof Error ? error.message : "fetch_failed"}`, evidenceUrl, verifiedAt);
      return 0;
    }
  });
  return results.reduce((total, count) => total + count, 0);
}

export async function checkGooglePlayPrices(database: Database, checkedAt = new Date()): Promise<number> {
  const apps = { openai: "com.openai.chatgpt", anthropic: "com.anthropic.claude", google: "com.google.android.apps.bard", xai: "ai.x.grok" };
  const jobs = Object.entries(apps).flatMap(([vendor, appId]) => OFFICIAL_SUBSCRIPTION_REGION_CATALOG.map(region => ({ vendor, appId, region })));
  const results = await mapWithConcurrency(jobs, 8, async ({ vendor, appId, region }) => {
    const url = `https://play.google.com/store/apps/details?id=${appId}&hl=en_US&gl=${region.countryCode}`;
    let status = "price_not_public", reason = "Google Play 公开应用页不提供可归属到此套餐的内购 SKU 价格，需应用内结算核验";
    try { await fetchText(url); } catch (error) { status = "fetch_failed"; reason = `来源访问失败：${error instanceof Error ? error.message : "fetch_failed"}`; }
    for (const plan of PLAN_SEEDS.filter(plan => plan.vendor === vendor)) await recordCheck(database, plan, "google_play", region.countryCode, status, reason, url, checkedAt);
    return 1;
  });
  return results.reduce((sum, count) => sum + count, 0);
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

export async function refreshOfficialSubscriptionChannels(database: Database): Promise<SubscriptionRefreshResult> {
  const verifiedAt = new Date();
  let exchangeRates = 0;
  try { exchangeRates = await refreshEcbCnyRates(database); } catch { /* keep native prices when ECB is unavailable */ }
  const seededPrices = await seedVerifiedSubscriptionPrices(database);
  const verifiedWebPrices = await verifyOfficialWebPrices(database, verifiedAt);
  let appStorePrices = 0;
  try { appStorePrices = await collectAppleAppStorePrices(database, verifiedAt); } catch { /* one source outage must not erase current values */ }
  const googlePlayChecks = await checkGooglePlayPrices(database, verifiedAt);
  return { exchangeRates, seededPrices, verifiedWebPrices, appStorePrices, googlePlayRanges: 0, googlePlayChecks };
}
