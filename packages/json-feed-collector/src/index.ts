import { createHash } from "node:crypto";
import type { CollectorAdapter, CollectorContext } from "@price-radar/collector-sdk";
import { rawOfferInputSchema, type CatalogPage, type CollectorKind, type ProbeResult, type RawOfferInput, type SnapshotValidation, type SourceIdentity } from "@price-radar/schema";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null { return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null; }
function first(source: JsonRecord, keys: readonly string[]): unknown { for (const key of keys) if (source[key] !== undefined && source[key] !== null) return source[key]; return undefined; }
function text(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined; }
function numeric(value: unknown): number | undefined { const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^0-9.-]/g, "")) : Number.NaN; return Number.isFinite(parsed) ? parsed : undefined; }
function hash(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

function itemArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const root = record(payload);
  if (!root) return [];
  for (const key of ["items", "products", "data", "results", "offers"]) {
    const value = root[key];
    if (Array.isArray(value)) return value;
    const nested = record(value);
    if (nested) for (const nestedKey of ["items", "products", "list", "records"]) if (Array.isArray(nested[nestedKey])) return nested[nestedKey] as unknown[];
  }
  return [];
}

function total(payload: unknown, fallback: number): number | undefined {
  const root = record(payload);
  const data = record(root?.data);
  const value = first(root ?? {}, ["total", "totalCount", "count"]) ?? first(data ?? {}, ["total", "totalCount", "count"]);
  const parsed = numeric(value);
  return parsed !== undefined && Number.isInteger(parsed) && parsed >= fallback ? parsed : undefined;
}

function nextUrl(payload: unknown, current: URL): string | undefined {
  const root = record(payload);
  const data = record(root?.data);
  const value = text(first(root ?? {}, ["next", "nextUrl", "next_url"]) ?? first(data ?? {}, ["next", "nextUrl", "next_url"]));
  if (!value) return undefined;
  const url = new URL(value, current);
  return url.origin === current.origin ? url.toString() : undefined;
}

async function fetchJson(url: URL, signal: AbortSignal): Promise<unknown> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: "error", signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), headers: { accept: "application/json", "user-agent": "AIPriceRadar/0.1 (+public-json-feed)" } });
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        if (attempt < 2) { await new Promise((resolve) => setTimeout(resolve, Math.min(2_000, retryAfter > 0 ? retryAfter * 1_000 : 250 * 2 ** attempt))); continue; }
      }
      if (!response.ok) throw new Error(`json_feed_http_${response.status}`);
      const length = Number(response.headers.get("content-length") ?? 0);
      if (length > 5_000_000) throw new Error("json_feed_too_large");
      const raw = await response.text();
      if (raw.length > 5_000_000) throw new Error("json_feed_too_large");
      return JSON.parse(raw) as unknown;
    } catch (error) {
      last = error;
      if (attempt >= 2 || (error instanceof Error && /json_feed_(?:http_4(?!29)|too_large)/.test(error.message))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    }
  }
  throw last;
}

function normalizedItem(item: unknown, sourceUrl: URL, now: Date): RawOfferInput {
  const value = record(item);
  if (!value) throw new Error("json_feed_item_not_object");
  const sourceItemId = text(first(value, ["id", "sourceItemId", "source_item_id", "productId", "product_id", "sku"]));
  const title = text(first(value, ["title", "name", "productName", "product_name"]));
  const amount = numeric(first(value, ["price", "amount", "salePrice", "sale_price", "unitAmount"]));
  if (!sourceItemId || !title || amount === undefined || amount < 0) throw new Error("json_feed_required_field_missing");
  const rawPrice = text(first(value, ["priceText", "price_text", "rawPrice", "price"])) ?? String(amount);
  const currency = (text(first(value, ["currency", "priceCurrency", "price_currency"])) ?? "CNY").toUpperCase();
  const stockCount = numeric(first(value, ["stockCount", "stock_count", "stock", "quantity", "inventory"]));
  const explicit = text(first(value, ["stockState", "stock_state", "availability", "status"]))?.toLowerCase();
  const stockState = stockCount === 0 || explicit === "out_of_stock" || explicit === "sold_out" ? "out_of_stock" : stockCount !== undefined || explicit === "in_stock" || explicit === "available" ? "in_stock" : "unknown";
  const link = text(first(value, ["url", "productUrl", "product_url", "link"]));
  const productUrl = link ? new URL(link, sourceUrl).toString() : sourceUrl.toString();
  return rawOfferInputSchema.parse({ sourceItemId, rawTitle: title, rawDescription: text(first(value, ["description", "body", "details"])), rawCategory: text(first(value, ["category", "categoryName", "category_name"])), rawPriceText: rawPrice, price: String(amount), currency, rawStock: first(value, ["stock", "inventory", "availability"]), ...(stockCount !== undefined ? { stockCount: Math.trunc(stockCount) } : {}), stockState, productUrl, capturedAt: now.toISOString(), rawPayloadHash: hash(item) });
}

export class JsonFeedCollector implements CollectorAdapter {
  readonly kind: CollectorKind;
  constructor(kind: "public_json" | "merchant_feed" = "public_json") { this.kind = kind; }
  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult> {
    try {
      const payload = await fetchJson(sourceUrl, signal);
      const items = itemArray(payload);
      if (!items.length) return { supported: false, collectorKind: this.kind, confidence: 0, evidence: [], reason: "json_feed_items_missing" };
      const root = record(payload);
      const isMerchantFeed = root?.schemaVersion !== undefined || root?.merchant !== undefined || root?.feedType === "ai-price-radar";
      const supported = this.kind === "merchant_feed" ? isMerchantFeed : !isMerchantFeed;
      return { supported, collectorKind: this.kind, confidence: supported ? (isMerchantFeed ? 0.99 : 0.86) : 0.1, identity: supported ? await this.resolveSourceIdentity(sourceUrl, signal) : undefined, evidence: ["public JSON response", `${items.length} items on first page`], reason: supported ? undefined : "json_feed_kind_mismatch" };
    } catch (error) { return { supported: false, collectorKind: this.kind, confidence: 0, evidence: [], reason: error instanceof Error ? error.message : "json_feed_probe_failed" }; }
  }
  async resolveSourceIdentity(sourceUrl: URL, _signal: AbortSignal): Promise<SourceIdentity> {
    return { platformKind: this.kind, platformMerchantId: hash(`${sourceUrl.origin}${sourceUrl.pathname}`).slice(0, 32), canonicalEntryUrl: sourceUrl.toString(), merchantName: sourceUrl.hostname };
  }
  async fetchCatalog(source: SourceIdentity, context: CollectorContext, cursor?: string): Promise<CatalogPage> {
    const url = new URL(cursor ?? source.canonicalEntryUrl);
    const canonical = new URL(source.canonicalEntryUrl);
    if (url.origin !== canonical.origin) throw new Error("json_feed_cross_origin_cursor");
    const payload = await fetchJson(url, context.signal);
    const items = itemArray(payload);
    return { items: items.map((item) => ({ item, sourceUrl: url.toString() })), cursor: url.toString(), ...(nextUrl(payload, url) ? { nextCursor: nextUrl(payload, url) } : {}), ...(total(payload, items.length) !== undefined ? { expectedTotal: total(payload, items.length) } : {}), rawPayloadHash: hash(payload) };
  }
  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation {
    const all = pages.flatMap((page) => page.items);
    const parsed: RawOfferInput[] = [];
    let invalid = 0;
    for (const wrapped of all) {
      try { const value = record(wrapped); parsed.push(normalizedItem(value?.item, new URL(text(value?.sourceUrl) ?? "https://invalid.example"), new Date())); } catch { invalid += 1; }
    }
    const ids = new Set<string>(); let duplicates = 0;
    for (const item of parsed) { if (ids.has(item.sourceItemId)) duplicates += 1; ids.add(item.sourceItemId); }
    const expectedTotal = pages.find((page) => page.expectedTotal !== undefined)?.expectedTotal;
    const issues: SnapshotValidation["issues"] = [];
    if (invalid) issues.push({ code: "json_feed_invalid_items", message: `${invalid} items are missing required fields.`, severity: "error" });
    if (duplicates) issues.push({ code: "duplicate_item_ids", message: `${duplicates} duplicate item identities.`, severity: "error" });
    if (expectedTotal !== undefined && all.length !== expectedTotal) issues.push({ code: "incomplete_pagination", message: `Expected ${expectedTotal}, fetched ${all.length}.`, severity: "error" });
    const completeSnapshot = issues.every((issue) => issue.severity !== "error");
    return { status: completeSnapshot ? "success" : "partial", completeSnapshot, ...(expectedTotal !== undefined ? { expectedTotal } : {}), fetchedTotal: all.length, parsedTotal: parsed.length, duplicateTotal: duplicates, issues };
  }
  normalizeItem(item: unknown, context: CollectorContext): RawOfferInput {
    const wrapped = record(item);
    return normalizedItem(wrapped?.item, new URL(text(wrapped?.sourceUrl) ?? "https://invalid.example"), context.now);
  }
}
