import { createHash } from "node:crypto";
import { hostThrottle, type CollectorAdapter, type CollectorContext } from "@price-radar/collector-sdk";
import {
  rawOfferInputSchema,
  type CatalogPage,
  type ProbeResult,
  type RawOfferInput,
  type SnapshotValidation,
  type SourceIdentity,
} from "@price-radar/schema";

interface KamiEnvelope {
  code: number;
  msg?: string;
  data?: unknown;
  total?: number;
}

interface KamiItem {
  id: string;
  name: string;
  price: number | string;
  stock?: number;
  status?: number;
  categoryName?: string;
  raw: unknown;
}

export interface KamiCollectorOptions {
  pageSize?: number;
  requestTimeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function asEnvelope(value: unknown): KamiEnvelope {
  if (!isRecord(value) || typeof value.code !== "number") {
    throw new Error("invalid_kami_response");
  }
  return {
    code: value.code,
    ...(typeof value.msg === "string" ? { msg: value.msg } : {}),
    ...(value.data !== undefined ? { data: value.data } : {}),
    ...(typeof value.total === "number" ? { total: value.total } : {}),
  };
}

function asItem(value: unknown): KamiItem {
  if (
    !isRecord(value) ||
    (typeof value.id !== "number" && typeof value.id !== "string") ||
    typeof value.name !== "string" ||
    (typeof value.price !== "number" && typeof value.price !== "string")
  ) {
    throw new Error("invalid_kami_item");
  }
  const categoryName =
    isRecord(value.category) && typeof value.category.name === "string"
      ? value.category.name
      : undefined;
  return {
    id: String(value.id),
    name: value.name,
    price: value.price,
    ...(typeof value.stock === "number" ? { stock: value.stock } : {}),
    ...(typeof value.status === "number" ? { status: value.status } : {}),
    ...(categoryName ? { categoryName } : {}),
    raw: value,
  };
}

function titleFromHtml(html: string, fallback: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() || fallback;
}

export class KamiCollector implements CollectorAdapter {
  readonly kind = "kami";
  readonly #pageSize: number;
  readonly #requestTimeoutMs: number;

  constructor(options: KamiCollectorOptions = {}) {
    this.#pageSize = options.pageSize ?? 10;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
  }

  async #get(url: URL, signal: AbortSignal): Promise<Response> {
    const response = await hostThrottle.run(url.hostname, () => fetch(url, {
      redirect: "error",
      headers: { accept: "application/json,text/html", "user-agent": "AIPriceRadar/0.1" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(this.#requestTimeoutMs)]),
    }), signal);
    if (response.status === 429 || response.status === 503) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 0);
      hostThrottle.cooldown(url.hostname, retryAfter > 0 ? retryAfter * 1_000 : 30_000);
    }
    if (!response.ok) throw new Error(`kami_http_${response.status}`);
    return response;
  }

  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult> {
    try {
      const identity = await this.resolveSourceIdentity(sourceUrl, signal);
      return {
        supported: true,
        collectorKind: "kami",
        confidence: 0.96,
        identity,
        evidence: ["kami_category_endpoint", "/user/api/index/data"],
      };
    } catch (error) {
      return {
        supported: false,
        collectorKind: "kami",
        confidence: 0,
        evidence: [],
        reason: error instanceof Error ? error.message : "kami_probe_failed",
      };
    }
  }

  async resolveSourceIdentity(sourceUrl: URL, signal: AbortSignal): Promise<SourceIdentity> {
    const origin = sourceUrl.origin;
    const [categoryResponse, homepageResponse] = await Promise.all([
      this.#get(new URL("/user/api/index/data", origin), signal),
      this.#get(new URL("/", origin), signal),
    ]);
    const envelope = asEnvelope(await categoryResponse.json());
    if (envelope.code !== 200 || !Array.isArray(envelope.data)) {
      throw new Error("kami_category_endpoint_rejected");
    }
    const html = await homepageResponse.text();
    return {
      platformKind: "kami",
      platformMerchantId: sourceUrl.hostname.toLowerCase(),
      canonicalEntryUrl: new URL("/", origin).toString(),
      merchantName: titleFromHtml(html, sourceUrl.hostname),
    };
  }

  async fetchCatalog(
    source: SourceIdentity,
    context: CollectorContext,
    cursor?: string,
  ): Promise<CatalogPage> {
    const page = cursor ? Number(cursor) : 1;
    if (!Number.isInteger(page) || page < 1) throw new Error("invalid_kami_cursor");
    const url = new URL("/user/api/index/commodity", source.canonicalEntryUrl);
    url.searchParams.set("limit", String(this.#pageSize));
    url.searchParams.set("page", String(page));
    const envelope = asEnvelope(await (await this.#get(url, context.signal)).json());
    if (envelope.code !== 200 || !Array.isArray(envelope.data)) {
      throw new Error(`kami_catalog_rejected:${envelope.msg ?? "unknown"}`);
    }
    const declaredTotal = envelope.total ?? envelope.data.length;
    const totalPages = Math.max(1, Math.ceil(declaredTotal / this.#pageSize));
    return {
      items: envelope.data.map((item) =>
        isRecord(item) ? { ...item, __origin: new URL(source.canonicalEntryUrl).origin } : item,
      ),
      cursor: String(page),
      ...(page < totalPages ? { nextCursor: String(page + 1) } : {}),
      expectedTotal: declaredTotal,
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
          const item = asItem(input);
          parsedTotal += 1;
          if (ids.has(item.id)) duplicateTotal += 1;
          ids.add(item.id);
        } catch {
          issues.push({ code: "unparseable_item", message: "Kami item fields are invalid.", severity: "error" });
        }
      }
    }
    const declaredTotal = pages[0]?.expectedTotal ?? parsedTotal;
    if (declaredTotal !== parsedTotal) {
      issues.push({
        code: "upstream_hidden_items",
        message: `Kami declared ${declaredTotal} rows and exposed ${parsedTotal}; hidden rows are not purchasable.`,
        severity: "warning",
      });
    }
    if (duplicateTotal > 0) {
      issues.push({ code: "duplicate_item_ids", message: `${duplicateTotal} duplicate Kami item IDs.`, severity: "error" });
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
    const item = asItem(input);
    const price = String(item.price);
    const stockState = item.status === 0 || item.stock === 0 ? "out_of_stock" : "in_stock";
    const origin = isRecord(item.raw) && typeof item.raw.__origin === "string"
      ? item.raw.__origin
      : "https://invalid.local";
    return rawOfferInputSchema.parse({
      sourceItemId: item.id,
      rawTitle: item.name,
      ...(item.categoryName ? { rawCategory: item.categoryName } : {}),
      rawPriceText: price,
      price,
      currency: "CNY",
      ...(isRecord(item.raw)
        ? { rawStock: { stock: item.raw.stock, stock_state: item.raw.stock_state } }
        : {}),
      ...(item.stock !== undefined ? { stockCount: item.stock } : {}),
      stockState,
      productUrl: new URL(`/item/${item.id}`, origin).toString(),
      capturedAt: context.now.toISOString(),
      rawPayloadHash: hashPayload(item.raw),
    });
  }
}
