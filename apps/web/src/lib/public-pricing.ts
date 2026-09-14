import { createOfficialSnapshotCache } from "./official-snapshot-cache";
import { query } from "./database";

export interface OfficialSubscriptionPrice {
  id: string;
  vendor: string;
  planCode: string;
  planName: string;
  billingPeriod: string;
  channel: string;
  countryCode: string;
  currency: string;
  priceKind: string;
  amount: string | null;
  lowerAmount: string | null;
  upperAmount: string | null;
  cnyEstimate: string | null;
  rawPlanName: string;
  appId: string | null;
  evidenceUrl: string;
  verifiedAt: Date;
  exchangeRateDate: string | null;
  exchangeRateUrl: string | null;
  historyCount: number;
  collectionStatus?: string | null;
  evidence?: Record<string, unknown>;
  billingVerified?: boolean;
  evidenceStatus?: string;
  eligibleForComparison?: boolean;
}

interface SubscriptionRow {
  id: string;
  vendor: string;
  plan_code: string;
  plan_name: string;
  billing_period: string;
  channel: string;
  country_code: string;
  currency: string;
  price_kind: string;
  amount: string | null;
  lower_amount: string | null;
  upper_amount: string | null;
  cny_estimate: string | null;
  raw_plan_name: string;
  app_id: string | null;
  evidence_url: string;
  verified_at: Date;
  exchange_rate_date: string | null;
  exchange_rate_url: string | null;
  history_count: string;
  evidence: Record<string, unknown>;
}

// Sources are swept once a day; allow one missed sweep before a quote counts as historical.
const OFFICIAL_SUBSCRIPTION_FRESHNESS_MS = 48 * 60 * 60 * 1_000;

type SubscriptionEvidence = Pick<OfficialSubscriptionPrice, "verifiedAt"> & Partial<Pick<OfficialSubscriptionPrice, "priceKind" | "evidenceUrl" | "collectionStatus" | "billingPeriod" | "rawPlanName" | "channel" | "evidence">>;

export function hasVerifiedSubscriptionBilling(row: SubscriptionEvidence): boolean {
  if (row.channel === "app_store" && (
    row.evidence?.billingEvidenceMethod === "same_country_vendor_page_match"
    || ["duplicate_explained", "vendor_monthly_amount"].includes(String(row.evidence?.resolvedBy))
    || (row.rawPlanName === "ChatGPT Plus" && row.evidence?.billingEvidenceMethod === "official_plan_document")
  )) return false;
  if (row.evidence?.billingPeriod === row.billingPeriod && typeof row.evidence?.billingEvidenceUrl === "string") return true;
  // The original SKU itself may explicitly state its period. Never infer it from the amount.
  return row.channel === "app_store" && (row.billingPeriod === "month"
    ? / - Monthly$/i.test(row.rawPlanName ?? "")
    : row.billingPeriod === "year" && / - Annual$/i.test(row.rawPlanName ?? ""));
}

export function isFreshOfficialSubscriptionPrice(
  row: SubscriptionEvidence,
  now = Date.now(),
): boolean {
  if (["price_anomaly", "ambiguous_sku", "sku_not_listed", "billing_unverified", "not_available", "storefront_redirected", "country_fallback", "currency_mismatch", "currency_unknown"].includes(row.collectionStatus ?? "")) return false;
  if (row.evidenceUrl?.includes("/introducing-chatgpt-go/")) return false;
  if (!hasVerifiedSubscriptionBilling(row)) return false;
  const verifiedAt = new Date(row.verifiedAt).getTime();
  return Number.isFinite(verifiedAt) && verifiedAt <= now + 5 * 60_000 && now - verifiedAt <= OFFICIAL_SUBSCRIPTION_FRESHNESS_MS;
}

export function getOfficialSubscriptionPriceStatus(row: SubscriptionEvidence, now = Date.now()): string {
  if (row.priceKind === "unknown") return "未公开套餐精确价";
  if (row.priceKind === "range") return "应用价格区间 · 非套餐报价";
  if (row.evidenceUrl?.includes("/introducing-chatgpt-go/")) return "公告参考价 · 非当前报价";
  if (row.collectionStatus === "price_anomaly") return "源站金额异常 · 待人工核验";
  if (row.collectionStatus === "ambiguous_sku") return "同名多价 · 待核验";
  if (row.collectionStatus === "sku_not_listed") return "本次列表未列出 · 历史记录";
  if (row.collectionStatus === "not_available") return "来源未提供本地区页面 · 历史记录";
  if (["storefront_redirected", "country_fallback", "currency_mismatch", "currency_unknown"].includes(row.collectionStatus ?? "")) return "本次采集未确认 · 历史记录";
  if (!hasVerifiedSubscriptionBilling(row) || row.collectionStatus === "billing_unverified") return "公开内购金额 · 周期待核验";
  if (!isFreshOfficialSubscriptionPrice(row, now)) return "历史标价 · 待更新";
  if (row.channel === "web") return row.evidence?.rolloutGated === true ? "官网公开标价 · 本币定价灰度中" : "官网公开标价";
  return "商店公开标价";
}

export function hasCurrentCnyEstimate(row: Pick<OfficialSubscriptionPrice, "cnyEstimate" | "exchangeRateDate">, now = Date.now()): boolean {
  if (row.cnyEstimate === null || !Number.isFinite(Number(row.cnyEstimate)) || Number(row.cnyEstimate) <= 0 || !row.exchangeRateDate) return false;
  const day = Date.parse(`${row.exchangeRateDate}T00:00:00Z`);
  const today = Math.floor(now / 86_400_000) * 86_400_000;
  return Number.isFinite(day) && day <= today && today - day <= 7 * 86_400_000;
}

/** A stable reference, not the cheapest quote across different tax/checkout conditions. */
export function selectOfficialSubscriptionReference(rows: OfficialSubscriptionPrice[], now = Date.now()): OfficialSubscriptionPrice | null {
  return [...rows].filter(row => row.priceKind === "exact" && row.amount !== null && isFreshOfficialSubscriptionPrice(row, now))
    .sort((a, b) => Number(b.countryCode === "US") - Number(a.countryCode === "US")
      || Number(b.channel === "web") - Number(a.channel === "web")
      || b.verifiedAt.getTime() - a.verifiedAt.getTime()
      || a.countryCode.localeCompare(b.countryCode))[0] ?? null;
}

/** Sort collected exact amounts in CNY; records without a usable conversion follow. */
export function sortCollectedSubscriptionPrices(rows: OfficialSubscriptionPrice[]): OfficialSubscriptionPrice[] {
  const amount = (row: OfficialSubscriptionPrice) => row.priceKind === "exact" && row.amount !== null
    && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0
    && row.cnyEstimate !== null && Number.isFinite(Number(row.cnyEstimate)) && Number(row.cnyEstimate) >= 0
    ? Number(row.cnyEstimate) : Infinity;
  return [...rows].sort((a, b) => amount(a) - amount(b)
    || a.countryCode.localeCompare(b.countryCode) || a.channel.localeCompare(b.channel)
    || a.id.localeCompare(b.id));
}

export function selectCollectedSubscriptionMinimum(rows: OfficialSubscriptionPrice[]): OfficialSubscriptionPrice | null {
  return sortCollectedSubscriptionPrices(rows).find(row => row.priceKind === "exact"
    && row.amount !== null && Number.isFinite(Number(row.amount)) && Number(row.amount) >= 0
    && row.cnyEstimate !== null && Number.isFinite(Number(row.cnyEstimate)) && Number(row.cnyEstimate) >= 0) ?? null;
}

export interface OfficialReferencePrice {
  planName: string;
  amount: string;
  currency: string;
  cnyEstimate: string | null;
  channel: string;
  countryCode: string;
  evidenceUrl: string;
  verifiedAt: Date;
}

export interface OfficialApiPrice {
  id: string;
  vendor: string;
  modelCode: string;
  modelName: string;
  modality: string;
  contextWindow: number | null;
  priceTier: string;
  unit: string;
  currency: string;
  inputPrice: string | null;
  cachedInputPrice: string | null;
  outputPrice: string | null;
  additionalPrices: Record<string, unknown>;
  freeTier: Record<string, unknown>;
  rateLimits: Record<string, unknown>;
  evidenceUrl: string;
  documentVersion: string | null;
  verifiedAt: Date;
  historyCount: number;
}

interface ApiRow {
  id: string;
  vendor: string;
  model_code: string;
  model_name: string;
  modality: string;
  context_window: number | null;
  price_tier: string;
  unit: string;
  currency: string;
  input_price: string | null;
  cached_input_price: string | null;
  output_price: string | null;
  additional_prices: Record<string, unknown>;
  free_tier: Record<string, unknown>;
  rate_limits: Record<string, unknown>;
  evidence_url: string;
  document_version: string | null;
  verified_at: Date;
  history_count: string;
}

export interface TransitProviderOverview {
  id: string;
  slug: string;
  displayName: string;
  websiteUrl: string;
  apiBaseUrl: string | null;
  statusUrl: string | null;
  operatorName: string | null;
  systemKind: string;
  evidenceUrl: string;
  modelCount: number;
  sampleCount7d: number;
  successRate7d: number | null;
  averageLatency7d: number | null;
  lastCheckedAt: Date | null;
}

interface TransitProviderRow {
  id: string;
  slug: string;
  display_name: string;
  website_url: string;
  api_base_url: string | null;
  status_url: string | null;
  operator_name: string | null;
  system_kind: string;
  evidence_url: string;
  model_count: string;
  sample_count_7d: string;
  success_rate_7d: string | null;
  average_latency_7d: string | null;
  last_checked_at: Date | null;
}

export interface TransitModelPrice {
  providerSlug: string;
  providerName: string;
  modelCode: string;
  displayName: string;
  currency: string;
  unit: string;
  inputPrice: string | null;
  outputPrice: string | null;
  multiplier: string | null;
  evidenceKind: string;
  evidenceUrl: string;
  verifiedAt: Date;
}

export interface TransitEvent {
  providerName: string;
  kind: string;
  title: string;
  details: string | null;
  evidenceUrl: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export async function getOfficialSubscriptionPrices(checksPromise = getOfficialSubscriptionChecks(), read: typeof query = query): Promise<OfficialSubscriptionPrice[]> {
  const [rows, checks] = await Promise.all([read<SubscriptionRow>(
    `select p.id, pl.vendor, pl.plan_code, pl.display_name as plan_name,
            pl.billing_period, p.channel, p.country_code, p.currency,
            p.price_kind, p.amount, p.lower_amount, p.upper_amount,
            p.cny_estimate, p.raw_plan_name, p.app_id, p.evidence_url, p.evidence,
            p.verified_at, er.effective_date::text as exchange_rate_date,
            er.source_url as exchange_rate_url,
            count(h.id)::text as history_count
       from official_subscription_prices p
       join official_subscription_plans pl on pl.id=p.plan_id
       left join exchange_rate_snapshots er on er.id=p.exchange_rate_snapshot_id
       left join official_subscription_price_history h on h.official_price_id=p.id
      where pl.active=true
      group by p.id,pl.id,er.id
      order by pl.vendor,pl.display_name,
               case p.price_kind when 'exact' then 0 when 'range' then 1 else 2 end,
               p.cny_estimate nulls last,p.channel,p.country_code`,
  ), checksPromise]);
  const statusIndex = new Map(checks.map(check => [`${check.vendor}:${check.planCode}:${check.channel}:${check.countryCode}`, check.status]));
  const prices = rows.map((row) => ({
    id: row.id, vendor: row.vendor, planCode: row.plan_code, planName: row.plan_name,
    billingPeriod: row.billing_period, channel: row.channel, countryCode: row.country_code,
    currency: row.currency, priceKind: row.price_kind, amount: row.amount,
    lowerAmount: row.lower_amount, upperAmount: row.upper_amount,
    cnyEstimate: row.cny_estimate, rawPlanName: row.raw_plan_name, appId: row.app_id,
    evidenceUrl: row.evidence_url, verifiedAt: row.verified_at, evidence: row.evidence,
    exchangeRateDate: row.exchange_rate_date, exchangeRateUrl: row.exchange_rate_url,
    historyCount: Number(row.history_count), collectionStatus: statusIndex.get(`${row.vendor}:${row.plan_code}:${row.channel}:${row.country_code}`) ?? null,
  }));
  return prices.map(row => ({ ...row, billingVerified: hasVerifiedSubscriptionBilling(row),
    evidenceStatus: getOfficialSubscriptionPriceStatus(row),
    eligibleForComparison: row.priceKind === "exact" && isFreshOfficialSubscriptionPrice(row) && hasCurrentCnyEstimate(row),
  }));
}

export async function getOfficialReferencePrice(productSlug: string): Promise<OfficialReferencePrice | null> {
  const [row] = await query<{
    plan_name: string; amount: string; currency: string; cny_estimate: string | null;
    channel: string; country_code: string; evidence_url: string; verified_at: Date;
  }>(
    `select pl.display_name as plan_name,p.amount,p.currency,p.cny_estimate,
            p.channel,p.country_code,p.evidence_url,p.verified_at
       from official_subscription_prices p
       join official_subscription_plans pl on pl.id=p.plan_id
       join canonical_products cp on cp.id=pl.canonical_product_id
      where cp.slug=$1 and p.price_kind='exact' and p.amount is not null
        and pl.billing_period='month'
      order by case p.channel when 'web' then 0 else 1 end,
               case p.country_code when 'US' then 0 else 1 end,
               p.verified_at desc
      limit 1`,
    [productSlug],
  );
  return row ? { planName: row.plan_name, amount: row.amount, currency: row.currency, cnyEstimate: row.cny_estimate, channel: row.channel, countryCode: row.country_code, evidenceUrl: row.evidence_url, verifiedAt: row.verified_at } : null;
}

export async function getOfficialApiPrices(): Promise<OfficialApiPrice[]> {
  const rows = await query<ApiRow>(
    `select p.id,v.display_name as vendor,m.model_code,m.display_name as model_name,
            m.modality,m.context_window,p.price_tier,p.unit,p.currency,
            p.input_price,p.cached_input_price,p.output_price,p.additional_prices,
            p.free_tier,p.rate_limits,p.evidence_url,p.document_version,p.verified_at,
            count(h.id)::text as history_count
       from official_api_prices p
       join official_api_models m on m.id=p.model_id
       join official_api_vendors v on v.id=m.vendor_id
       left join official_api_price_history h on h.official_api_price_id=p.id
      where v.active=true
      group by p.id,m.id,v.id
      order by v.display_name,m.display_name,p.price_tier`,
  );
  return rows.map((row) => ({
    id: row.id, vendor: row.vendor, modelCode: row.model_code, modelName: row.model_name,
    modality: row.modality, contextWindow: row.context_window, priceTier: row.price_tier,
    unit: row.unit, currency: row.currency, inputPrice: row.input_price,
    cachedInputPrice: row.cached_input_price, outputPrice: row.output_price,
    additionalPrices: row.additional_prices, freeTier: row.free_tier,
    rateLimits: row.rate_limits, evidenceUrl: row.evidence_url,
    documentVersion: row.document_version, verifiedAt: row.verified_at,
    historyCount: Number(row.history_count),
  }));
}

export async function getTransitOverview(): Promise<{ providers: TransitProviderOverview[]; prices: TransitModelPrice[]; events: TransitEvent[] }> {
  const providers = await query<TransitProviderRow>(
    `select p.id,p.slug,p.display_name,p.website_url,p.api_base_url,p.status_url,
            p.operator_name,p.system_kind,p.evidence_url,
            count(distinct mp.id)::text as model_count,
            count(distinct pr.id) filter (where pr.checked_at >= now()-interval '7 days')::text as sample_count_7d,
            avg(case when pr.success then 1.0 else 0.0 end) filter (where pr.checked_at >= now()-interval '7 days')::text as success_rate_7d,
            avg(pr.latency_ms) filter (where pr.success and pr.checked_at >= now()-interval '7 days')::text as average_latency_7d,
            max(pr.checked_at) as last_checked_at
       from transit_providers p
       left join transit_model_prices mp on mp.provider_id=p.id
       left join transit_probes pr on pr.provider_id=p.id
      where p.active=true
      group by p.id
      order by p.display_name`,
  );
  const prices = await query<{
    provider_slug: string; provider_name: string; model_code: string; display_name: string;
    currency: string; unit: string; input_price: string | null; output_price: string | null;
    multiplier: string | null; evidence_kind: string; evidence_url: string; verified_at: Date;
  }>(
    `select p.slug as provider_slug,p.display_name as provider_name,mp.model_code,
            mp.display_name,mp.currency,mp.unit,mp.input_price,mp.output_price,
            mp.multiplier,mp.evidence_kind,mp.evidence_url,mp.verified_at
       from transit_model_prices mp join transit_providers p on p.id=mp.provider_id
      where p.active=true order by p.display_name,mp.model_code limit 300`,
  );
  const events = await query<{
    provider_name: string; kind: string; title: string; details: string | null;
    evidence_url: string | null; started_at: Date; ended_at: Date | null;
  }>(
    `select p.display_name as provider_name,e.kind,e.title,e.details,e.evidence_url,e.started_at,e.ended_at
       from transit_events e join transit_providers p on p.id=e.provider_id
      order by e.started_at desc limit 30`,
  );
  return {
    providers: providers.map((row) => ({ id: row.id, slug: row.slug, displayName: row.display_name, websiteUrl: row.website_url, apiBaseUrl: row.api_base_url, statusUrl: row.status_url, operatorName: row.operator_name, systemKind: row.system_kind, evidenceUrl: row.evidence_url, modelCount: Number(row.model_count), sampleCount7d: Number(row.sample_count_7d), successRate7d: row.success_rate_7d === null ? null : Number(row.success_rate_7d), averageLatency7d: row.average_latency_7d === null ? null : Number(row.average_latency_7d), lastCheckedAt: row.last_checked_at })),
    prices: prices.map((row) => ({ providerSlug: row.provider_slug, providerName: row.provider_name, modelCode: row.model_code, displayName: row.display_name, currency: row.currency, unit: row.unit, inputPrice: row.input_price, outputPrice: row.output_price, multiplier: row.multiplier, evidenceKind: row.evidence_kind, evidenceUrl: row.evidence_url, verifiedAt: row.verified_at })),
    events: events.map((row) => ({ providerName: row.provider_name, kind: row.kind, title: row.title, details: row.details, evidenceUrl: row.evidence_url, startedAt: row.started_at, endedAt: row.ended_at })),
  };
}

export interface OfficialSubscriptionCheck {
  vendor: string; planCode: string; channel: string; countryCode: string;
  status: string; reason: string; evidenceUrl: string; checkedAt: Date;
  evidence: Record<string, unknown>;
}

type CheckRow = { vendor: string; plan_code: string; channel: string; country_code: string; status: string; reason: string; evidence_url: string; checked_at: Date; evidence?: Record<string, unknown> | null };

export async function getOfficialSubscriptionChecks(read: typeof query = query): Promise<OfficialSubscriptionCheck[]> {
  const rows = await read<CheckRow>(
    "select vendor,plan_code,channel,country_code,status,reason,evidence_url,checked_at,evidence from official_subscription_checks",
  ).catch(async (error: unknown) => {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    // Rolling deployments may serve web code before migrations 0016/0017 complete.
    if (code === "42P01") return [] as CheckRow[];
    if (code === "42703") return read<CheckRow>("select vendor,plan_code,channel,country_code,status,reason,evidence_url,checked_at from official_subscription_checks");
    throw error;
  });
  return rows.map(row => ({ vendor: row.vendor, planCode: row.plan_code, channel: row.channel, countryCode: row.country_code, status: row.status, reason: row.reason, evidenceUrl: row.evidence_url, checkedAt: row.checked_at, evidence: row.evidence ?? {} }));
}

/** Share one checks request with price classification and the page's evidence table. */
async function loadOfficialSubscriptionSnapshot(read: typeof query) {
  const checksPromise = getOfficialSubscriptionChecks(read);
  const [prices, checks] = await Promise.allSettled([
    getOfficialSubscriptionPrices(checksPromise, read), checksPromise,
  ]);
  return {
    prices: prices.status === "fulfilled" ? prices.value : [],
    checks: checks.status === "fulfilled" ? checks.value : null,
    available: prices.status === "fulfilled",
  };
}

const cachedOfficialSnapshot = createOfficialSnapshotCache(() => loadOfficialSubscriptionSnapshot(query));

export function getOfficialSubscriptionSnapshot(read: typeof query = query) {
  return read === query ? cachedOfficialSnapshot() : loadOfficialSubscriptionSnapshot(read);
}
