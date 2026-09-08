import { hostThrottle } from "@price-radar/collector-sdk";
import type { Database } from "@price-radar/database";
import { SIXTEEN688_FAMILY } from "@price-radar/source-signatures";
import { lastSuccessfulDiscoveryAt, recordDiscoveryRun, type CandidateLead } from "./candidates.js";

/**
 * 16688 exposes a public "source marketplace" (源头广场) that lists wholesale goods
 * by category. Each goods number resolves to the shop that sells it, which gives
 * a platform-native list of AI shops without depending on any other directory.
 */
const ORIGIN = SIXTEEN688_FAMILY.primaryOrigin;
const AI_CATEGORY_NAME = "AI与效率";
const PAGE_SIZE = 20;
export const SIXTEEN688_MARKETPLACE_PROVIDER = "16688_source_marketplace";

interface Envelope { code?: number; msg?: string; data?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function post(path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
  const url = new URL(path, ORIGIN);
  return hostThrottle.run(url.hostname, async () => {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers: { accept: "application/json, text/plain, */*", "content-type": "application/json", origin: ORIGIN, referer: `${ORIGIN}/source`, "user-agent": "AIPriceRadar/0.1 (+source-discovery)" },
      body: JSON.stringify(body),
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
    });
    if (!response.ok) throw new Error(`16688_marketplace_http_${response.status}`);
    const envelope = (await response.json()) as Envelope;
    if (envelope.code !== 1) throw new Error(`16688_marketplace_rejected:${envelope.msg ?? "unknown"}`);
    return envelope.data;
  }, signal);
}

export interface MarketplaceCategory { id: number | string; name: string }

export function parseCategoryTree(data: unknown): MarketplaceCategory[] {
  const list = isRecord(data) && Array.isArray(data.list) ? data.list : [];
  const categories: MarketplaceCategory[] = [];
  const visit = (rows: unknown[]) => {
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const id = row.id;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if ((typeof id === "number" || typeof id === "string") && name) categories.push({ id, name });
      if (Array.isArray(row.children)) visit(row.children);
    }
  };
  visit(list);
  categories.sort((left, right) => Number(right.name === AI_CATEGORY_NAME) - Number(left.name === AI_CATEGORY_NAME));
  return categories;
}

export interface Enumerate16688Options {
  signal?: AbortSignal;
  /** Enumerate every category instead of only the AI category. */
  allCategories?: boolean;
  maxPagesPerCategory?: number;
  minIntervalMs?: number;
  now?: Date;
}

export async function enumerate16688SourceMarketplace(db: Database, options: Enumerate16688Options = {}) {
  const signal = options.signal ?? new AbortController().signal;
  const now = options.now ?? new Date();
  if (options.minIntervalMs) {
    const last = await lastSuccessfulDiscoveryAt(db, SIXTEEN688_MARKETPLACE_PROVIDER);
    if (last && now.getTime() - last.getTime() < options.minIntervalMs) return { status: "skipped" as const };
  }
  const run = await recordDiscoveryRun(db, { kind: "platform", query: `${ORIGIN}/source`, provider: SIXTEEN688_MARKETPLACE_PROVIDER }, async () => {
    const categories = parseCategoryTree(await post("/index/SourceCategory/tree", {}, signal));
    const selected = options.allCategories ? categories : categories.filter((category) => category.name === AI_CATEGORY_NAME);
    const maxPages = Math.max(1, options.maxPagesPerCategory ?? 25);
    const shopByMerchant = new Map<string, string>();
    const seenShops = new Set<string>();
    const leads: CandidateLead[] = [];
    for (const category of selected) {
      for (let page = 1; page <= maxPages; page += 1) {
        const data = await post("/index/SourceGoods/list", { page_no: page, page_size: PAGE_SIZE, source_category_id: category.id }, signal);
        const list = isRecord(data) && Array.isArray(data.list) ? data.list : [];
        if (list.length === 0) break;
        for (const item of list) {
          if (!isRecord(item) || typeof item.goods_no !== "string" || !item.goods_no.trim()) continue;
          const goodsNo = item.goods_no.trim();
          const merchantNo = isRecord(item.merchant) && typeof item.merchant.merchant_no === "string" ? item.merchant.merchant_no : "";
          let shopNo = merchantNo ? shopByMerchant.get(merchantNo) : undefined;
          let shopName: string | undefined;
          if (!shopNo) {
            const detail = await post("/shopApi/goods/detail", { goods_no: goodsNo }, signal).catch(() => null);
            if (!isRecord(detail) || typeof detail.shop_no !== "string" || !detail.shop_no.trim()) continue;
            shopNo = detail.shop_no.trim();
            shopName = typeof detail.shop_alias === "string" && detail.shop_alias.trim() ? detail.shop_alias.trim() : undefined;
            if (merchantNo) shopByMerchant.set(merchantNo, shopNo);
          }
          if (seenShops.has(shopNo)) continue;
          seenShops.add(shopNo);
          leads.push({
            url: `${ORIGIN}/shop/${encodeURIComponent(shopNo)}`,
            provider: SIXTEEN688_MARKETPLACE_PROVIDER,
            discoveryKind: "platform",
            discoveryUrl: `${ORIGIN}/goods/${encodeURIComponent(goodsNo)}`,
            ...(shopName ? { nameHint: shopName } : {}),
          });
        }
        const total = isRecord(data) && typeof data.total === "number" ? data.total : undefined;
        if (list.length < PAGE_SIZE || (total !== undefined && page * PAGE_SIZE >= total)) break;
      }
    }
    return leads;
  });
  return { status: "success" as const, ...run };
}
