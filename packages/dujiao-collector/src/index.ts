import { createHash } from "node:crypto";
import type { CollectorAdapter, CollectorContext } from "@price-radar/collector-sdk";
import {
  rawOfferInputSchema,
  type CatalogPage,
  type ProbeResult,
  type RawOfferInput,
  type SnapshotValidation,
  type SourceIdentity,
} from "@price-radar/schema";

interface DujiaoEnvelope {
  statusCode: number;
  msg?: string;
  data: unknown;
  pagination?: { page: number; pageSize: number; total: number; totalPage: number };
}

interface FlatOffer {
  sourceItemId: string;
  title: string;
  description?: string;
  category?: string;
  price: string;
  stockCount?: number;
  stockState: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  productUrl: string;
  raw: unknown;
}

export interface DujiaoCollectorOptions {
  pageSize?: number;
  requestTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function localized(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!isRecord(value)) return undefined;
  for (const key of ["zh-CN", "zh-TW", "en-US"]) {
    const text = value[key];
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return undefined;
}

function asEnvelope(value: unknown): DujiaoEnvelope {
  if (!isRecord(value) || typeof value.status_code !== "number") {
    throw new Error("invalid_dujiao_response");
  }
  let pagination: DujiaoEnvelope["pagination"];
  if (
    isRecord(value.pagination) &&
    typeof value.pagination.page === "number" &&
    typeof value.pagination.page_size === "number" &&
    typeof value.pagination.total === "number" &&
    typeof value.pagination.total_page === "number"
  ) {
    pagination = {
      page: value.pagination.page,
      pageSize: value.pagination.page_size,
      total: value.pagination.total,
      totalPage: value.pagination.total_page,
    };
  }
  return {
    statusCode: value.status_code,
    ...(typeof value.msg === "string" ? { msg: value.msg } : {}),
    data: value.data,
    ...(pagination ? { pagination } : {}),
  };
}

function stockCountFor(value: Record<string, unknown>): number | undefined {
  const auto = typeof value.auto_stock_available === "number" ? value.auto_stock_available : 0;
  const manualTotal = typeof value.manual_stock_total === "number" ? value.manual_stock_total : 0;
  const manualSold = typeof value.manual_stock_sold === "number" ? value.manual_stock_sold : 0;
  const upstream = typeof value.upstream_stock === "number" ? value.upstream_stock : 0;
  const total = auto + Math.max(0, manualTotal - manualSold) + Math.max(0, upstream);
  const quantityHidden = value.stock_quantity_hidden === true;
  return quantityHidden ? undefined : total;
}

function stockStateFor(value: Record<string, unknown>): FlatOffer["stockState"] {
  if (value.is_sold_out === true || value.stock_status === "out_of_stock") return "out_of_stock";
  if (value.stock_status === "low_stock") return "low_stock";
  if (value.stock_status === "in_stock" || value.stock_status === "unlimited") return "in_stock";
  return "unknown";
}

function flattenProducts(data: unknown[], origin: string): FlatOffer[] {
  const offers: FlatOffer[] = [];
  for (const input of data) {
    if (!isRecord(input) || typeof input.id !== "number") continue;
    const productTitle = localized(input.title);
    const slug = typeof input.slug === "string" ? input.slug : String(input.id);
    const productUrl = new URL(`/products/${encodeURIComponent(slug)}`, origin).toString();
    const description = localized(input.description);
    const category = isRecord(input.category) ? localized(input.category.name) : undefined;
    const skus = Array.isArray(input.skus)
      ? input.skus.filter((sku) => isRecord(sku) && sku.is_active !== false)
      : [];

    if (skus.length > 0) {
      for (const sku of skus) {
        if (!isRecord(sku) || (typeof sku.id !== "number" && typeof sku.id !== "string")) continue;
        const price = sku.price_amount;
        if (typeof price !== "string" && typeof price !== "number") continue;
        const spec = localized(sku.spec_values);
        const stockCount = stockCountFor(sku);
        offers.push({
          sourceItemId: `${input.id}:${String(sku.id)}`,
          title: [productTitle, spec].filter(Boolean).join(" / ") || `Product ${input.id}`,
          ...(description ? { description } : {}),
          ...(category ? { category } : {}),
          price: String(price),
          ...(stockCount !== undefined ? { stockCount } : {}),
          stockState: stockStateFor(sku),
          productUrl,
          raw: { product: input, sku },
        });
      }
      continue;
    }

    const price = input.price_amount;
    if (typeof price !== "string" && typeof price !== "number") continue;
    const stockCount = stockCountFor(input);
    offers.push({
      sourceItemId: String(input.id),
      title: productTitle ?? `Product ${input.id}`,
      ...(description ? { description } : {}),
      ...(category ? { category } : {}),
      price: String(price),
      ...(stockCount !== undefined ? { stockCount } : {}),
      stockState: stockStateFor(input),
      productUrl,
      raw: input,
    });
  }
  return offers;
}

function asFlatOffer(value: unknown): FlatOffer {
  if (
    !isRecord(value) ||
    typeof value.sourceItemId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.price !== "string" ||
    typeof value.productUrl !== "string" ||
    !["in_stock", "low_stock", "out_of_stock", "unknown"].includes(String(value.stockState))
  ) {
    throw new Error("invalid_dujiao_flat_offer");
  }
  return value as unknown as FlatOffer;
}

export class DujiaoCollector implements CollectorAdapter {
  readonly kind = "dujiao";
  readonly #pageSize: number;
  readonly #requestTimeoutMs: number;
  readonly #currencyByOrigin = new Map<string, string>();

  constructor(options: DujiaoCollectorOptions = {}) {
    this.#pageSize = options.pageSize ?? 50;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  }

  async #json(url: URL, signal: AbortSignal): Promise<DujiaoEnvelope> {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "AIPriceRadar/0.1" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(this.#requestTimeoutMs)]),
    });
    if (!response.ok) throw new Error(`dujiao_http_${response.status}`);
    const envelope = asEnvelope(await response.json());
    if (envelope.statusCode !== 0) {
      throw new Error(`dujiao_rejected:${envelope.msg ?? "unknown"}`);
    }
    return envelope;
  }

  async #loadConfig(origin: string, signal: AbortSignal): Promise<Record<string, unknown>> {
    const envelope = await this.#json(new URL("/api/v1/public/config", origin), signal);
    if (!isRecord(envelope.data)) throw new Error("invalid_dujiao_config");
    const currency = typeof envelope.data.currency === "string" ? envelope.data.currency : "CNY";
    this.#currencyByOrigin.set(origin, currency.toUpperCase());
    return envelope.data;
  }

  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult> {
    try {
      const identity = await this.resolveSourceIdentity(sourceUrl, signal);
      return {
        supported: true,
        collectorKind: "dujiao",
        confidence: 0.97,
        identity,
        evidence: ["dujiao_public_config", "/api/v1/public/config"],
      };
    } catch (error) {
      return {
        supported: false,
        collectorKind: "dujiao",
        confidence: 0,
        evidence: [],
        reason: error instanceof Error ? error.message : "dujiao_probe_failed",
      };
    }
  }

  async resolveSourceIdentity(sourceUrl: URL, signal: AbortSignal): Promise<SourceIdentity> {
    const config = await this.#loadConfig(sourceUrl.origin, signal);
    const brand = isRecord(config.brand) ? config.brand : undefined;
    const siteName = brand && typeof brand.site_name === "string"
      ? brand.site_name
      : sourceUrl.hostname;
    return {
      platformKind: "dujiao",
      platformMerchantId: sourceUrl.hostname.toLowerCase(),
      canonicalEntryUrl: new URL("/", sourceUrl.origin).toString(),
      merchantName: siteName,
    };
  }

  async fetchCatalog(
    source: SourceIdentity,
    context: CollectorContext,
    cursor?: string,
  ): Promise<CatalogPage> {
    const page = cursor ? Number(cursor) : 1;
    if (!Number.isInteger(page) || page < 1) throw new Error("invalid_dujiao_cursor");
    const origin = new URL(source.canonicalEntryUrl).origin;
    if (page === 1 || !this.#currencyByOrigin.has(origin)) {
      await this.#loadConfig(origin, context.signal);
    }
    const url = new URL("/api/v1/public/products", origin);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(this.#pageSize));
    const envelope = await this.#json(url, context.signal);
    if (!Array.isArray(envelope.data) || !envelope.pagination) {
      throw new Error("invalid_dujiao_catalog");
    }
    const items = flattenProducts(envelope.data, origin).map((item) => ({
      ...item,
      __currency: this.#currencyByOrigin.get(origin) ?? "CNY",
    }));
    return {
      items,
      cursor: String(page),
      ...(page < envelope.pagination.totalPage ? { nextCursor: String(page + 1) } : {}),
      rawPayloadHash: hashPayload(envelope),
    };
  }

  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation {
    const ids = new Set<string>();
    const issues: SnapshotValidation["issues"] = [];
    let parsedTotal = 0;
    let duplicateTotal = 0;
    for (const page of pages) {
      for (const input of page.items) {
        try {
          const item = asFlatOffer(input);
          parsedTotal += 1;
          if (ids.has(item.sourceItemId)) duplicateTotal += 1;
          ids.add(item.sourceItemId);
        } catch {
          issues.push({ code: "unparseable_item", message: "Dujiao product or SKU is invalid.", severity: "error" });
        }
      }
    }
    if (duplicateTotal > 0) {
      issues.push({ code: "duplicate_item_ids", message: `${duplicateTotal} duplicate Dujiao SKU IDs.`, severity: "error" });
    }
    const completeSnapshot = issues.every((issue) => issue.severity !== "error");
    return {
      status: completeSnapshot ? "success" : parsedTotal > 0 ? "partial" : "failed",
      completeSnapshot,
      expectedTotal: parsedTotal,
      fetchedTotal: parsedTotal,
      parsedTotal,
      duplicateTotal,
      issues,
    };
  }

  normalizeItem(input: unknown, context: CollectorContext): RawOfferInput {
    const item = asFlatOffer(input);
    const currency = isRecord(input) && typeof input.__currency === "string" ? input.__currency : "CNY";
    return rawOfferInputSchema.parse({
      sourceItemId: item.sourceItemId,
      rawTitle: item.title,
      ...(item.description ? { rawDescription: item.description } : {}),
      ...(item.category ? { rawCategory: item.category } : {}),
      rawPriceText: item.price,
      price: item.price,
      currency,
      rawStock: isRecord(item.raw) ? item.raw : { value: item.raw },
      ...(item.stockCount !== undefined ? { stockCount: item.stockCount } : {}),
      stockState: item.stockState,
      productUrl: item.productUrl,
      capturedAt: context.now.toISOString(),
      rawPayloadHash: hashPayload(item.raw),
    });
  }
}
