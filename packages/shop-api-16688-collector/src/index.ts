import { createHash } from "node:crypto";
import { hostThrottle, WafChallengeError, wafChallengeSignature, type CollectorAdapter, type CollectorContext, type HostThrottle } from "@price-radar/collector-sdk";
import {
  rawOfferInputSchema,
  type CatalogPage,
  type ProbeResult,
  type RawOfferInput,
  type SnapshotValidation,
  type SourceIdentity,
} from "@price-radar/schema";
import { SIXTEEN688_FAMILY, familyForHost } from "@price-radar/source-signatures";

/**
 * 16688.com.cn storefront collector.
 *
 * The platform exposes a JSON API for its shop pages. Every shop's goods come
 * back in one `goods/list` response (pagination parameters are ignored), so a
 * complete snapshot is a single request. Goods pages are `/goods/<goods_no>`,
 * shop pages are `/shop/<shop_no>`; the bare `16688.com.cn` host redirects to
 * `www`, so the collector always talks to the family's primary origin.
 */

export const SIXTEEN688_ORIGIN = SIXTEEN688_FAMILY.primaryOrigin;

interface ApiEnvelope {
  code: number;
  msg?: string;
  data?: unknown;
}

interface ShopDetail {
  shopNo: string;
  shopAlias?: string;
  name?: string;
  contact: Record<string, string>;
}

interface GoodsItem {
  goods_no: string;
  name: string;
  price: number | string;
  description?: string;
  stock_available_quantity?: number;
  stock_available_status?: string;
  goods_category_no?: string;
  delivery_method?: number;
  limit_quantity?: number;
  sales_count_text?: string;
}

export interface Sixteen688CollectorOptions {
  requestTimeoutMs?: number;
  userAgent?: string;
  throttle?: HostThrottle;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/h\d>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function asGoodsItem(value: unknown): GoodsItem {
  if (
    !isRecord(value) ||
    typeof value.goods_no !== "string" ||
    !value.goods_no.trim() ||
    typeof value.name !== "string" ||
    (typeof value.price !== "number" && typeof value.price !== "string")
  ) {
    throw new Error("invalid_16688_goods_item");
  }
  const item: GoodsItem = { goods_no: value.goods_no.trim(), name: value.name, price: value.price };
  if (typeof value.description === "string") item.description = value.description;
  if (typeof value.stock_available_quantity === "number") item.stock_available_quantity = value.stock_available_quantity;
  if (typeof value.stock_available_status === "string") item.stock_available_status = value.stock_available_status;
  if (typeof value.goods_category_no === "string") item.goods_category_no = value.goods_category_no;
  if (typeof value.delivery_method === "number") item.delivery_method = value.delivery_method;
  if (typeof value.limit_quantity === "number") item.limit_quantity = value.limit_quantity;
  if (typeof value.sales_count_text === "string") item.sales_count_text = value.sales_count_text;
  return item;
}

function asShopDetail(value: unknown): ShopDetail {
  if (!isRecord(value) || typeof value.shop_no !== "string" || !value.shop_no.trim()) {
    throw new Error("invalid_16688_shop_detail");
  }
  const contact: Record<string, string> = {};
  const qq = text(value.contact_qq);
  const wechat = text(value.contact_wechat);
  const telegram = text(value.contact_telegram);
  if (qq) contact.qq = qq;
  if (wechat) contact.wechat = wechat;
  if (telegram) contact.telegram = telegram;
  const shopAlias = text(value.shop_alias);
  const name = text(value.name);
  return {
    shopNo: value.shop_no.trim(),
    ...(shopAlias ? { shopAlias } : {}),
    ...(name ? { name } : {}),
    contact,
  };
}

/** Maps the platform's stock fields onto the shared stock state vocabulary. */
export function stockFor(item: Pick<GoodsItem, "stock_available_quantity" | "stock_available_status">): { stockState: RawOfferInput["stockState"]; stockCount?: number } {
  const quantity = item.stock_available_quantity;
  const status = (item.stock_available_status ?? "").toLowerCase();
  if (/sold_out|out_of_stock|缺货|售罄|无货|已售完/.test(status)) {
    return { stockState: "out_of_stock", ...(quantity !== undefined && quantity >= 0 ? { stockCount: quantity } : {}) };
  }
  if (quantity !== undefined && quantity >= 0) {
    return { stockState: quantity === 0 ? "out_of_stock" : "in_stock", stockCount: quantity };
  }
  if (/in_stock|有货|充足|现货/.test(status)) return { stockState: "in_stock" };
  return { stockState: "unknown" };
}

export class Sixteen688ShopCollector implements CollectorAdapter {
  readonly kind = "shop_api_16688";
  readonly #requestTimeoutMs: number;
  readonly #userAgent: string;
  readonly #throttle: HostThrottle;

  constructor(options: Sixteen688CollectorOptions = {}) {
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.#userAgent = options.userAgent ?? "AIPriceRadar/0.1 (+https://localhost.invalid/source-policy)";
    this.#throttle = options.throttle ?? hostThrottle;
  }

  async #post(path: string, body: unknown, signal: AbortSignal, referer = `${SIXTEEN688_ORIGIN}/`): Promise<unknown> {
    const url = new URL(path, SIXTEEN688_ORIGIN);
    return this.#throttle.run(url.hostname, async () => {
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: {
          accept: "application/json, text/plain, */*",
          "content-type": "application/json",
          origin: SIXTEEN688_ORIGIN,
          referer,
          "user-agent": this.#userAgent,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(this.#requestTimeoutMs)]),
      });
      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        this.#throttle.cooldown(url.hostname, retryAfter > 0 ? retryAfter * 1_000 : 30_000);
      }
      if (!response.ok) throw new Error(`shop_api_16688_http_${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        const text = (await response.text().catch(() => "")).slice(0, 32_768);
        const signature = wafChallengeSignature(response.headers, text);
        if (signature) {
          this.#throttle.cooldown(url.hostname, 60_000);
          throw new WafChallengeError(url.hostname, signature);
        }
        throw new Error("shop_api_16688_not_json");
      }
      const envelope = (await response.json()) as ApiEnvelope;
      if (envelope.code !== 1) throw new Error(`shop_api_16688_rejected:${envelope.msg ?? "unknown"}`);
      return envelope.data;
    }, signal);
  }

  static parseUrl(sourceUrl: URL): { kind: "shop" | "goods"; id: string } | null {
    if (familyForHost(sourceUrl.hostname)?.key !== SIXTEEN688_FAMILY.key) return null;
    const shop = SIXTEEN688_FAMILY.shopPath.exec(sourceUrl.pathname);
    if (shop?.[1]) return { kind: "shop", id: shop[1] };
    const goods = SIXTEEN688_FAMILY.itemPath.exec(sourceUrl.pathname);
    if (goods?.[1]) return { kind: "goods", id: goods[1] };
    return null;
  }

  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult> {
    const target = Sixteen688ShopCollector.parseUrl(sourceUrl);
    if (!target) {
      return { supported: false, collectorKind: "shop_api_16688", confidence: 0, evidence: [], reason: "host_or_path_not_supported" };
    }
    try {
      const identity = await this.resolveSourceIdentity(sourceUrl, signal);
      return {
        supported: true,
        collectorKind: "shop_api_16688",
        confidence: 0.98,
        identity,
        evidence: ["16688_shop_detail_response", `shop_no:${identity.platformMerchantId}`],
      };
    } catch (error) {
      return {
        supported: false,
        collectorKind: "shop_api_16688",
        confidence: 0.1,
        evidence: [],
        reason: error instanceof Error ? error.message : "probe_failed",
      };
    }
  }

  async resolveSourceIdentity(sourceUrl: URL, signal: AbortSignal): Promise<SourceIdentity> {
    const target = Sixteen688ShopCollector.parseUrl(sourceUrl);
    if (!target) throw new Error("unsupported_16688_url");
    let shopNo = target.id;
    if (target.kind === "goods") {
      const detail = await this.#post("/shopApi/goods/detail", { goods_no: target.id }, signal, `${SIXTEEN688_ORIGIN}/goods/${target.id}`);
      if (!isRecord(detail) || typeof detail.shop_no !== "string" || !detail.shop_no.trim()) {
        throw new Error("goods_missing_shop_no");
      }
      shopNo = detail.shop_no.trim();
    }
    const shop = asShopDetail(
      await this.#post("/shopApi/shop/detail", { shop_no: shopNo }, signal, `${SIXTEEN688_ORIGIN}/shop/${shopNo}`),
    );
    return {
      platformKind: SIXTEEN688_FAMILY.platformKind,
      platformMerchantId: shop.shopNo,
      shopToken: shop.shopNo,
      canonicalEntryUrl: `${SIXTEEN688_ORIGIN}/shop/${shop.shopNo}`,
      ...(shop.name ? { merchantName: shop.name } : {}),
      ...(Object.keys(shop.contact).length > 0 ? { contact: shop.contact } : {}),
    };
  }

  async fetchCatalog(source: SourceIdentity, context: CollectorContext, cursor?: string): Promise<CatalogPage> {
    if (cursor && cursor !== "1") throw new Error("invalid_16688_cursor");
    const shopNo = source.shopToken ?? source.platformMerchantId;
    const data = await this.#post(
      "/shopApi/goods/list",
      { shop_no: shopNo, page_no: 1, page_size: 500 },
      context.signal,
      `${SIXTEEN688_ORIGIN}/shop/${shopNo}`,
    );
    if (!isRecord(data) || !Array.isArray(data.list)) throw new Error("invalid_16688_goods_list");
    return {
      items: data.list,
      cursor: "1",
      expectedTotal: data.list.length,
      rawPayloadHash: hashPayload(data),
    };
  }

  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation {
    const ids = new Set<string>();
    const issues: SnapshotValidation["issues"] = [];
    let parsedTotal = 0;
    let duplicateTotal = 0;
    let fetchedTotal = 0;
    for (const page of pages) {
      fetchedTotal += page.items.length;
      for (const raw of page.items) {
        try {
          const item = asGoodsItem(raw);
          parsedTotal += 1;
          if (ids.has(item.goods_no)) duplicateTotal += 1;
          ids.add(item.goods_no);
        } catch {
          issues.push({ code: "unparseable_item", message: "16688 goods item lacks goods_no, name or price.", severity: "error" });
        }
      }
    }
    if (pages.length !== 1) {
      issues.push({ code: "unexpected_page_count", message: `16688 returns one page per shop but ${pages.length} were collected.`, severity: "error" });
    }
    if (duplicateTotal > 0) {
      issues.push({ code: "duplicate_item_ids", message: `${duplicateTotal} duplicate goods_no values were returned.`, severity: "error" });
    }
    const completeSnapshot = issues.every((issue) => issue.severity !== "error");
    return {
      status: completeSnapshot ? "success" : parsedTotal > 0 ? "partial" : "failed",
      completeSnapshot,
      expectedTotal: fetchedTotal,
      fetchedTotal,
      parsedTotal,
      duplicateTotal,
      issues,
    };
  }

  normalizeItem(itemInput: unknown, context: CollectorContext): RawOfferInput {
    const item = asGoodsItem(itemInput);
    const price = typeof item.price === "number" ? String(item.price) : item.price.trim();
    const stock = stockFor(item);
    return rawOfferInputSchema.parse({
      sourceItemId: item.goods_no,
      rawTitle: cleanText(item.name) || item.goods_no,
      ...(item.description ? { rawDescription: cleanText(item.description) } : {}),
      ...(item.goods_category_no ? { rawCategory: item.goods_category_no } : {}),
      rawPriceText: price,
      price,
      currency: "CNY",
      rawStock: {
        quantity: item.stock_available_quantity ?? null,
        status: item.stock_available_status ?? null,
        deliveryMethod: item.delivery_method ?? null,
        limitQuantity: item.limit_quantity ?? null,
        salesCountText: item.sales_count_text ?? null,
      },
      ...(stock.stockCount !== undefined ? { stockCount: stock.stockCount } : {}),
      stockState: stock.stockState,
      productUrl: `${SIXTEEN688_ORIGIN}/goods/${encodeURIComponent(item.goods_no)}`,
      capturedAt: context.now.toISOString(),
      rawPayloadHash: hashPayload(itemInput),
    });
  }
}
