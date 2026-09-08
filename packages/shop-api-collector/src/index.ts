import { createHash } from "node:crypto";
import {
  hostThrottle,
  type CollectorAdapter,
  type CollectorContext,
  type HostThrottle,
} from "@price-radar/collector-sdk";
import {
  rawOfferInputSchema,
  type CatalogPage,
  type ProbeResult,
  type RawOfferInput,
  type SnapshotValidation,
  type SourceIdentity,
} from "@price-radar/schema";
import { failoverOrigins, familyForHost, shopApiPlatformKind } from "@price-radar/source-signatures";

const GOODS_TYPES = ["card", "article", "resource", "equity"] as const;

interface CursorState {
  typeIndex: number;
  page: number;
}

interface ApiEnvelope {
  code: number;
  msg?: string;
  data?: unknown;
}

interface ShopInfo {
  token: string;
  nickname?: string;
  link?: string;
  createdAt?: string;
  contact: Record<string, string>;
}

interface GoodsListData {
  total: number;
  list: unknown[];
}

interface GoodsItem {
  goods_key: string;
  name: string;
  price: number | string;
  link: string;
  description?: string;
  category?: { name?: string };
  extend?: { stock_count?: number };
  user?: { token?: string; nickname?: string; link?: string };
}

export interface ShopApiCollectorOptions {
  pageSize?: number;
  requestTimeoutMs?: number;
  userAgent?: string;
  throttle?: HostThrottle;
}

/** Errors that justify retrying the same request on another family origin. */
function failoverable(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name}:${error.message}${error.cause instanceof Error ? `:${error.cause.message}` : ""}` : String(error);
  return /redirect|fetch failed|ECONNREFUSED|ENOTFOUND|ECONNRESET|EAI_AGAIN|UND_ERR|certificate|shop_api_http_(?:30\d|403|404|5\d\d)|shop_api_not_json/i.test(message);
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cleanText(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeCursor(cursor?: string): CursorState {
  if (!cursor) return { typeIndex: 0, page: 1 };

  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
  if (
    !isRecord(parsed) ||
    !Number.isInteger(parsed.typeIndex) ||
    !Number.isInteger(parsed.page) ||
    Number(parsed.typeIndex) < 0 ||
    Number(parsed.typeIndex) >= GOODS_TYPES.length ||
    Number(parsed.page) < 1
  ) {
    throw new Error("invalid_shop_api_cursor");
  }

  return { typeIndex: Number(parsed.typeIndex), page: Number(parsed.page) };
}

function encodeCursor(cursor: CursorState): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function asShopInfo(value: unknown): ShopInfo {
  if (!isRecord(value) || typeof value.token !== "string") {
    throw new Error("invalid_shop_info_payload");
  }
  const contact: Record<string, string> = {};
  for (const [field, key] of [["contact_qq", "qq"], ["contact_wechat", "wechat"], ["contact_telegram", "telegram"], ["contact_email", "email"]] as const) {
    const text = optionalText(value[field]);
    if (text) contact[key] = text;
  }
  const createdAt = typeof value.create_time === "number" && value.create_time > 0
    ? new Date(value.create_time * 1_000).toISOString()
    : undefined;
  return {
    token: value.token,
    ...(typeof value.nickname === "string" ? { nickname: value.nickname } : {}),
    ...(typeof value.link === "string" ? { link: value.link } : {}),
    ...(createdAt ? { createdAt } : {}),
    contact,
  };
}

function asGoodsList(value: unknown): GoodsListData {
  if (
    !isRecord(value) ||
    typeof value.total !== "number" ||
    !Array.isArray(value.list)
  ) {
    throw new Error("invalid_goods_list_payload");
  }
  return { total: value.total, list: value.list };
}

function asGoodsItem(value: unknown): GoodsItem {
  if (
    !isRecord(value) ||
    typeof value.goods_key !== "string" ||
    typeof value.name !== "string" ||
    (typeof value.price !== "string" && typeof value.price !== "number") ||
    typeof value.link !== "string"
  ) {
    throw new Error("invalid_goods_item_payload");
  }

  const item: GoodsItem = {
    goods_key: value.goods_key,
    name: value.name,
    price: value.price,
    link: value.link,
  };
  if (typeof value.description === "string") item.description = value.description;
  if (isRecord(value.category) && typeof value.category.name === "string") {
    item.category = { name: value.category.name };
  }
  if (isRecord(value.extend) && typeof value.extend.stock_count === "number") {
    item.extend = { stock_count: value.extend.stock_count };
  }
  if (isRecord(value.user)) {
    item.user = {
      ...(typeof value.user.token === "string" ? { token: value.user.token } : {}),
      ...(typeof value.user.nickname === "string"
        ? { nickname: value.user.nickname }
        : {}),
      ...(typeof value.user.link === "string" ? { link: value.user.link } : {}),
    };
  }
  return item;
}

export class LdxpShopApiCollector implements CollectorAdapter {
  readonly kind = "shop_api";
  readonly #pageSize: number;
  readonly #requestTimeoutMs: number;
  readonly #userAgent: string;
  readonly #throttle: HostThrottle;
  /** Origin that last answered for each platform family, so a rotated domain is learned once. */
  readonly #preferredOrigin = new Map<string, string>();

  constructor(options: ShopApiCollectorOptions = {}) {
    this.#pageSize = options.pageSize ?? 100;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.#userAgent =
      options.userAgent ?? "AIPriceRadar/0.1 (+https://localhost.invalid/source-policy)";
    this.#throttle = options.throttle ?? hostThrottle;
  }

  async #postOnce(origin: string, path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    const url = new URL(path, origin);
    return this.#throttle.run(url.hostname, async () => {
      const timeoutSignal = AbortSignal.timeout(this.#requestTimeoutMs);
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": this.#userAgent,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, timeoutSignal]),
      });
      if (response.status === 429 || response.status === 503) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        this.#throttle.cooldown(url.hostname, retryAfter > 0 ? retryAfter * 1_000 : 30_000);
      }
      if (!response.ok) throw new Error(`shop_api_http_${response.status}`);
      if (!(response.headers.get("content-type") ?? "").includes("json")) {
        const text = (await response.text()).slice(0, 32_768);
        if (/_waf_|captcha|cf-chl-|challenge-platform|访问验证|安全验证/i.test(text)) {
          this.#throttle.cooldown(url.hostname, 30_000);
          throw new Error("shop_api_access_challenge");
        }
        throw new Error("shop_api_not_json");
      }
      const envelope = (await response.json()) as ApiEnvelope;
      if (envelope.code !== 1) {
        throw new Error(`shop_api_rejected:${envelope.msg ?? "unknown"}`);
      }
      return envelope.data;
    }, signal);
  }

  /**
   * Posts to the requested origin and, when that origin redirects or is down,
   * retries the same request on the other domains of the same platform family.
   */
  async #post(origin: string, path: string, body: unknown, signal: AbortSignal): Promise<unknown> {
    const family = familyForHost(new URL(origin).hostname);
    const preferred = family ? this.#preferredOrigin.get(family.key) : undefined;
    const origins = [...new Set([preferred ?? origin, origin, ...failoverOrigins(origin)])];
    let lastError: unknown;
    for (const [index, candidate] of origins.entries()) {
      try {
        const data = await this.#postOnce(candidate, path, body, signal);
        if (family && candidate !== preferred) this.#preferredOrigin.set(family.key, candidate);
        return data;
      } catch (error) {
        lastError = error;
        if (signal.aborted || index === origins.length - 1 || !failoverable(error)) throw error;
      }
    }
    throw lastError;
  }

  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult> {
    const evidence: string[] = [];
    if (familyForHost(sourceUrl.hostname)?.platformKind === "shop_api_16688") {
      return { supported: false, collectorKind: "shop_api", confidence: 0, evidence, reason: "host_owned_by_16688_collector" };
    }
    if (!/^\/(?:shop|item)\//.test(sourceUrl.pathname)) {
      return {
        supported: false,
        collectorKind: "shop_api",
        confidence: 0,
        evidence,
        reason: "path_not_supported",
      };
    }

    try {
      const identity = await this.resolveSourceIdentity(sourceUrl, signal);
      evidence.push("public_shop_api_response", `merchant_token:${identity.platformMerchantId}`);
      return {
        supported: true,
        collectorKind: "shop_api",
        confidence: 0.98,
        identity,
        evidence,
      };
    } catch (error) {
      return {
        supported: false,
        collectorKind: "shop_api",
        confidence: 0.1,
        evidence,
        reason: error instanceof Error ? error.message : "probe_failed",
      };
    }
  }

  async resolveSourceIdentity(sourceUrl: URL, signal: AbortSignal): Promise<SourceIdentity> {
    const parts = sourceUrl.pathname.split("/").filter(Boolean);
    const resource = parts[0];
    const key = parts[1];
    if (!key || (resource !== "shop" && resource !== "item")) {
      throw new Error("unsupported_shop_api_url");
    }

    let token = key;
    let merchantName: string | undefined;
    if (resource === "item") {
      const item = asGoodsItem(
        await this.#post(sourceUrl.origin, "/shopApi/Shop/goodsInfo", { goods_key: key }, signal),
      );
      if (!item.user?.token) throw new Error("item_missing_merchant_token");
      token = item.user.token;
      merchantName = item.user.nickname;
    }

    const info = asShopInfo(
      await this.#post(sourceUrl.origin, "/shopApi/Shop/info", { token }, signal),
    );

    // The platform reports the shop's current public link. Trust it only when it
    // stays inside the same family (or the same host), then prefer it as the
    // canonical origin so rotated domains repair themselves on the next crawl.
    const family = familyForHost(sourceUrl.hostname);
    let canonicalOrigin = family?.primaryOrigin ?? sourceUrl.origin;
    if (info.link) {
      try {
        const linkUrl = new URL(info.link);
        const sameFamily = family ? familyForHost(linkUrl.hostname)?.key === family.key : linkUrl.hostname === sourceUrl.hostname;
        if ((linkUrl.protocol === "https:" || linkUrl.protocol === "http:") && sameFamily) canonicalOrigin = linkUrl.origin;
      } catch {
        // Ignore malformed links; the family primary origin stays canonical.
      }
    }

    return {
      platformKind: shopApiPlatformKind(new URL(canonicalOrigin).hostname),
      platformMerchantId: info.token,
      shopToken: info.token,
      canonicalEntryUrl: new URL(`/shop/${info.token}`, canonicalOrigin).toString(),
      ...(info.nickname || merchantName
        ? { merchantName: info.nickname ?? merchantName }
        : {}),
      ...(info.createdAt ? { merchantCreatedAt: info.createdAt } : {}),
      ...(Object.keys(info.contact).length > 0 ? { contact: info.contact } : {}),
    };
  }

  async fetchCatalog(
    source: SourceIdentity,
    context: CollectorContext,
    cursor?: string,
  ): Promise<CatalogPage> {
    if (!source.shopToken) throw new Error("shop_token_required");
    const state = decodeCursor(cursor);
    const goodsType = GOODS_TYPES[state.typeIndex];
    if (!goodsType) throw new Error("invalid_goods_type_index");

    const origin = new URL(source.canonicalEntryUrl).origin;
    const data = asGoodsList(
      await this.#post(
        origin,
        "/shopApi/Shop/goodsList",
        {
          token: source.shopToken,
          goods_type: goodsType,
          current: state.page,
          pageSize: this.#pageSize,
        },
        context.signal,
      ),
    );

    const hasMorePages = state.page * this.#pageSize < data.total;
    const hasMoreTypes = state.typeIndex + 1 < GOODS_TYPES.length;
    const nextCursor = hasMorePages
      ? encodeCursor({ typeIndex: state.typeIndex, page: state.page + 1 })
      : hasMoreTypes
        ? encodeCursor({ typeIndex: state.typeIndex + 1, page: 1 })
        : undefined;

    return {
      items: data.list,
      cursor: encodeCursor(state),
      ...(nextCursor ? { nextCursor } : {}),
      expectedTotal: data.total,
      rawPayloadHash: hashPayload(data),
    };
  }

  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation {
    const expectedByType = new Map<number, number>();
    const fetchedByType = new Map<number, number>();
    const ids = new Set<string>();
    let duplicateTotal = 0;
    let parsedTotal = 0;
    const issues: SnapshotValidation["issues"] = [];

    for (const page of pages) {
      const state = decodeCursor(page.cursor);
      if (page.expectedTotal !== undefined && !expectedByType.has(state.typeIndex)) {
        expectedByType.set(state.typeIndex, page.expectedTotal);
      }
      fetchedByType.set(
        state.typeIndex,
        (fetchedByType.get(state.typeIndex) ?? 0) + page.items.length,
      );
      for (const rawItem of page.items) {
        try {
          const item = asGoodsItem(rawItem);
          parsedTotal += 1;
          if (ids.has(item.goods_key)) duplicateTotal += 1;
          ids.add(item.goods_key);
        } catch {
          issues.push({
            code: "unparseable_item",
            message: "Shop API returned an item without required identity or price fields.",
            severity: "error",
          });
        }
      }
    }

    const expectedTotal = [...expectedByType.values()].reduce((sum, value) => sum + value, 0);
    const fetchedTotal = [...fetchedByType.values()].reduce((sum, value) => sum + value, 0);
    if (expectedByType.size !== GOODS_TYPES.length) {
      issues.push({
        code: "missing_goods_type",
        message: "Not every Shop API goods type completed.",
        severity: "error",
      });
    }
    if (expectedTotal !== fetchedTotal) {
      issues.push({
        code: "catalog_count_mismatch",
        message: `Expected ${expectedTotal} items but fetched ${fetchedTotal}.`,
        severity: "error",
      });
    }
    if (duplicateTotal > 0) {
      issues.push({
        code: "duplicate_item_ids",
        message: `${duplicateTotal} duplicate item identities were returned.`,
        severity: "error",
      });
    }

    const completeSnapshot = issues.every((issue) => issue.severity !== "error");
    return {
      status: completeSnapshot ? "success" : parsedTotal > 0 ? "partial" : "failed",
      completeSnapshot,
      expectedTotal,
      fetchedTotal,
      parsedTotal,
      duplicateTotal,
      issues,
    };
  }

  normalizeItem(itemInput: unknown, context: CollectorContext): RawOfferInput {
    const item = asGoodsItem(itemInput);
    const price = String(item.price);
    const stockCount = item.extend?.stock_count;
    const stockState =
      stockCount === undefined ? "unknown" : stockCount === 0 ? "out_of_stock" : "in_stock";

    return rawOfferInputSchema.parse({
      sourceItemId: item.goods_key,
      rawTitle: cleanText(item.name),
      ...(item.description ? { rawDescription: cleanText(item.description) } : {}),
      ...(item.category?.name ? { rawCategory: cleanText(item.category.name) } : {}),
      rawPriceText: price,
      price,
      currency: "CNY",
      rawStock: item.extend,
      ...(stockCount !== undefined ? { stockCount } : {}),
      stockState,
      productUrl: item.link,
      capturedAt: context.now.toISOString(),
      rawPayloadHash: hashPayload(itemInput),
    });
  }
}
