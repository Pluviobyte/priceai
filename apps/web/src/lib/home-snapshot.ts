import type { OfferMode } from "@price-radar/schema";

import { query } from "./database";
import { getPublicCatalog, getPublicMarketChanges } from "./public-catalog";
import { getCachedOfficialSubscriptionPrices, isFreshOfficialSubscriptionPrice, hasCurrentCnyEstimate, type OfficialSubscriptionPrice } from "./public-pricing";

/** 把 10 种 offerMode 归成 4 类“账号最后归谁”，这是首页解释差价用的口径。 */
export type DeliveryFamily = "official" | "own-account" | "handed-over" | "usage-only";

export const DELIVERY_FAMILY_OF: Record<OfferMode, DeliveryFamily> = {
  recharge: "own-account",
  team_seat: "own-account",
  finished_account: "handed-over",
  redeem_code: "handed-over",
  shared_account: "usage-only",
  web_mirror: "usage-only",
  reverse_proxy: "usage-only",
  api_credit: "usage-only",
  short_term: "handed-over",
  unknown: "handed-over",
};

export const OFFER_MODE_LABEL: Record<OfferMode, string> = {
  recharge: "代充",
  finished_account: "成品账号",
  redeem_code: "兑换码",
  team_seat: "团队席位",
  shared_account: "共享账号",
  web_mirror: "网页镜像",
  reverse_proxy: "反代",
  api_credit: "API 额度",
  short_term: "短期商品",
  unknown: "待确认",
};

export interface BaselineRow {
  slug: string;
  name: string;
  /** 用于顶部品牌筛选，取 canonical_products.brand。 */
  brand: string;
  /** model-icons 里的 key，取不到时为 null。 */
  icon: string | null;
  /** 规格摘要，例如「1 个月」。同规格才可比。 */
  spec: string;
  /** 官方价，折人民币。区间价不进入这里，只认精确价。 */
  official: { cny: number; note: string; evidenceUrl: string } | null;
  /** 已收录同套餐、同周期的官方地区/渠道最低价。 */
  officialFloor?: { cny: number; note: string; evidenceUrl: string } | null;
  /** 当前可买最低价：24 小时内验证过、有货、与官方价同规格。 */
  lowest: {
    cny: number;
    mode: OfferMode;
    merchantName: string | null;
    warrantyNote: string;
  } | null;
  /** 全部有效报价的价格带，用于分布条。 */
  band: { minCny: number; maxCny: number } | null;
  offerCount: number;
  inStockMerchantCount: number;
  verifiedAt: string | null;
}

export interface ChangeRow {
  productSlug: string;
  productName: string;
  merchantName: string;
  kind: "price-down" | "price-up" | "restock" | "sold-out";
  before: string;
  after: string;
  delta: string;
  observedAt: string;
}

export interface HomeSnapshot {
  baseline: BaselineRow[];
  changes: ChangeRow[];
  coverage: { verifiedOfferCount: number; activeSourceCount: number; officialVendorCount: number; publishedAt: string | null };
  /** 占位数据时为 true，页面据此收起所有具体数字，避免把示例价当成事实展示。 */
  placeholder: boolean;
  warnings?: string[];
}

const PLACEHOLDER: HomeSnapshot = {
  baseline: [
    { slug: "chatgpt-plus", name: "ChatGPT Plus", brand: "OpenAI", icon: "openai", spec: "1 个月", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
    { slug: "claude-pro", name: "Claude Pro", brand: "Anthropic", icon: "claude", spec: "1 个月", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
    { slug: "gemini-pro", name: "Google AI Pro", brand: "Google", icon: "gemini", spec: "1 个月", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
    { slug: "supergrok", name: "SuperGrok", brand: "xAI", icon: "grok", spec: "1 个月", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
  ],
  changes: [],
  coverage: { verifiedOfferCount: 0, activeSourceCount: 0, officialVendorCount: 0, publishedAt: null },
  placeholder: true,
};


const PLAN_CODES: Record<string, string> = { "chatgpt-plus": "chatgpt-plus-monthly", "claude-pro": "claude-pro-monthly", "gemini-pro": "google-ai-pro-monthly", supergrok: "supergrok-monthly" };
export interface HomeOffer {
  id: string; slug: string; price: string; currency: string; mode: OfferMode;
  merchant_id: string; merchant_name: string; warranty_type: string; verified_at: Date;
}

export function buildHomeBaseline(prices: OfficialSubscriptionPrice[], offers: HomeOffer[]): BaselineRow[] {
  return PLACEHOLDER.baseline.map(base => {
    const officialPrices = prices.filter(p => p.planCode === PLAN_CODES[base.slug] && p.billingPeriod === "month"
      && ["web", "app_store", "google_play"].includes(p.channel) && p.priceKind === "exact"
      && p.amount !== null && Number.isFinite(Number(p.amount)) && Number(p.amount) > 0
      && isFreshOfficialSubscriptionPrice(p) && hasCurrentCnyEstimate(p));
    const reference = officialPrices.filter(p => p.channel === "web" && p.countryCode === "US")
      .sort((a,b) => b.verifiedAt.getTime() - a.verifiedAt.getTime())[0];
    const floor = [...officialPrices].sort((a,b) => Number(a.cnyEstimate) - Number(b.cnyEstimate)
      || b.verifiedAt.getTime() - a.verifiedAt.getTime() || a.id.localeCompare(b.id))[0];
    const officialQuote = (price: OfficialSubscriptionPrice | undefined) => {
      if (!price) return null;
      let region = price.countryCode;
      try { region = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(region) ?? region; } catch { /* Preserve unknown region codes. */ }
      const channel = ({ web: "官网", app_store: "App Store", google_play: "Google Play" } as Record<string, string>)[price.channel];
      return { cny: Number(price.cnyEstimate), evidenceUrl: price.evidenceUrl,
        note: `${region} ${channel} ${price.currency} ${Number(price.amount)}/月 · ${price.verifiedAt.toLocaleDateString("zh-CN", {timeZone:"Asia/Shanghai"})}核验` };
    };
    const eligible = offers.filter(o => o.slug === base.slug && o.currency === "CNY" && Number(o.price) > 0 && Number.isFinite(Number(o.price)))
      .sort((a,b) => Number(a.price)-Number(b.price) || b.verified_at.getTime()-a.verified_at.getTime() || a.id.localeCompare(b.id));
    const lowest = eligible[0];
    const sameMode = lowest ? eligible.filter(o => o.mode === lowest.mode) : [];
    return { ...base,
      official: officialQuote(reference),
      officialFloor: officialQuote(floor),
      lowest: lowest ? { cny: Number(lowest.price), mode: lowest.mode, merchantName: lowest.merchant_name, warrantyNote: ["none","unknown"].includes(lowest.warranty_type) ? "质保未确认" : "商家标注质保，购买前复核" } : null,
      band: sameMode.length ? { minCny: Number(lowest!.price), maxCny: Math.max(...sameMode.map(o=>Number(o.price))) } : null,
      offerCount: sameMode.length, inStockMerchantCount: new Set(sameMode.map(o=>o.merchant_id)).size,
      verifiedAt: lowest?.verified_at.toISOString() ?? null,
    };
  });
}

export async function getHomeSnapshot(): Promise<HomeSnapshot> {
  const results = await Promise.allSettled([
    getCachedOfficialSubscriptionPrices(),
    query<HomeOffer>(`select distinct o.id,cp.slug,o.price,o.currency,o.offer_mode mode,m.id merchant_id,m.name merchant_name,
        coalesce(oa.warranty_type,'unknown') warranty_type,o.offer_verified_at verified_at
      from offers o join canonical_products cp on cp.id=o.canonical_product_id
      join publication_channels pc on pc.current_generation_id=o.publish_generation_id and pc.channel='card_prices'
      join sources s on s.id=o.source_id join merchants m on m.id=s.merchant_id
      join offer_matches om on om.raw_offer_snapshot_id=o.latest_raw_snapshot_id
      join offer_attributes oa on oa.offer_match_id=om.id
      where cp.slug=any($1) and cp.status='active' and m.status='active' and s.enabled=true
        and o.availability_state='purchasable' and o.stock_state in ('in_stock','low_stock')
        and o.offer_verified_at>now()-interval '24 hours' and o.offer_verified_at<=now()
        and o.currency='CNY' and o.price>0 and oa.duration_days=30 and coalesce(oa.shared,false)=false
        and o.offer_mode in ('recharge','finished_account','redeem_code')`, [Object.keys(PLAN_CODES)]),
    getPublicCatalog(), getPublicMarketChanges(1),
  ]);
  const [official, channels, catalog, market] = results;
  const warnings = results.flatMap((r,i)=>r.status === "rejected" ? [["官方价格","渠道报价","覆盖统计","价格异动"][i]+"暂时读取失败"] : []);
  for (const [i,r] of results.entries()) if(r.status === "rejected") console.error("home_snapshot_source_failed",i,r.reason);
  const baseline = buildHomeBaseline(official.status === "fulfilled" ? official.value : [], channels.status === "fulfilled" ? channels.value : []);
  const changes: ChangeRow[] = market.status === "fulfilled" ? market.value.flatMap(change => {
    const before = Number(change.previousPrice), after = Number(change.price);
    if(!Number.isFinite(before) || !Number.isFinite(after)) return [];
    const stock = ["in_stock","low_stock"];
    const restock = change.previousStockState === "out_of_stock" && stock.includes(change.stockState);
    const soldOut = stock.includes(change.previousStockState) && change.stockState === "out_of_stock";
    if(!restock && !soldOut && before === after) return [];
    return [{ productSlug:change.productSlug,productName:change.productName,merchantName:change.merchantName,
      kind:restock ? "restock" as const : soldOut ? "sold-out" as const : after<before ? "price-down" as const : "price-up" as const,
      before:restock||soldOut ? (restock?"缺货":"有货") : `${change.currency} ${before}`,
      after:restock||soldOut ? (restock?"补货":"售罄") : `${change.currency} ${after}`,
      delta:restock?"补货":soldOut?"售罄":`${after<before?"−":"+"}${change.currency} ${Math.abs(after-before).toFixed(2)}`,
      observedAt:change.observedAt.toISOString() }];
  }).slice(0,6) : [];
  return { baseline, changes, warnings, placeholder: official.status === "rejected" && channels.status === "rejected",
    coverage:{ verifiedOfferCount:catalog.status === "fulfilled" ? catalog.value.verifiedOfferCount : 0,
      activeSourceCount:catalog.status === "fulfilled" ? catalog.value.activeSourceCount : 0,
      officialVendorCount:new Set(baseline.filter(r=>r.official).map(r=>r.brand)).size,
      publishedAt:catalog.status === "fulfilled" ? catalog.value.publishedAt?.toISOString() ?? null : null } };
}
