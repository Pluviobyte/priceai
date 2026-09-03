import type { OfferMode } from "@price-radar/schema";

/**
 * 首页快照。首页只读这一个入口，形状与真实查询一致。
 *
 * TODO(接真实数据)：把 getHomeSnapshot 的函数体换成下面三个已有查询的组合，
 * 其余首页组件不需要改动。
 *   1. baseline    ← getProductSummaries()（已有 lowestPrice / warrantyLowestPrice /
 *                     offerCount / inStockCount / lowestMerchantName / latestVerifiedAt）
 *                     再对每个 slug 调 getOfficialReferencePrice(slug) 取官方价与证据链接。
 *   2. changes     ← getPublicMarketChanges(1)，按 observedAt 取前若干条。
 *   3. coverage    ← getPublicCatalog() 的 verifiedOfferCount / activeSourceCount / publishedAt。
 *
 * 还缺一个字段：getProductSummaries 目前不返回“最低价那条报价的交付方式”。
 * 需要在 public-catalog.ts:472 的聚合里补一列：
 *   (array_agg(oa.offer_mode order by o.price asc nulls last)
 *      filter (where o.availability_state='purchasable'
 *        and o.offer_verified_at>now()-interval '24 hours'))[1] lowest_offer_mode
 * 交付方式是首页与官方价对照的核心，缺它这张表就退化成单纯的低价榜。
 *
 * 同一个字段还卡住了首页「差价的来源」四张卡的深链接：/channels 目前只支持
 * platform / q / sort，没有交付方式筛选，所以四张卡暂时都指向 /channels。
 * 补上 offer_mode 之后，给 subscriptions/page.tsx 加一个 mode 白名单参数，
 * 再把卡片链接改成 /channels?mode=recharge 等。
 */

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
  /** 规格摘要，例如「1 个月 · 个人」。同规格才可比。 */
  spec: string;
  /** 官方价，折人民币。区间价不进入这里，只认精确价。 */
  official: { cny: number; note: string; evidenceUrl: string } | null;
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
}

const PLACEHOLDER: HomeSnapshot = {
  baseline: [
    { slug: "chatgpt-plus", name: "ChatGPT Plus", brand: "OpenAI", icon: "openai", spec: "1 个月 · 个人" , official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
    { slug: "claude-pro", name: "Claude Pro", brand: "Anthropic", icon: "claude", spec: "1 个月 · 个人", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
    { slug: "google-ai-pro", name: "Google AI Pro", brand: "Google", icon: "gemini", spec: "1 个月 · 个人", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
    { slug: "supergrok", name: "SuperGrok", brand: "xAI", icon: "grok", spec: "1 个月 · 个人", official: null, lowest: null, band: null, offerCount: 0, inStockMerchantCount: 0, verifiedAt: null },
  ],
  changes: [],
  coverage: { verifiedOfferCount: 0, activeSourceCount: 0, officialVendorCount: 0, publishedAt: null },
  placeholder: true,
};

export async function getHomeSnapshot(): Promise<HomeSnapshot> {
  // TODO(接真实数据)：见文件头。在此之前返回占位结构，页面会显示“数据接入中”。
  return PLACEHOLDER;
}
