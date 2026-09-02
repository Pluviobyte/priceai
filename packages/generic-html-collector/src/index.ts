import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { CollectorAdapter, CollectorContext } from "@price-radar/collector-sdk";
import {
  rawOfferInputSchema,
  type CatalogPage,
  type ProbeResult,
  type RawOfferInput,
  type SnapshotValidation,
  type SourceIdentity,
} from "@price-radar/schema";

interface ParsedHtmlOffer {
  sourceItemId: string;
  title: string;
  description?: string;
  price: string;
  currency: string;
  stockCount?: number;
  stockState: "in_stock" | "out_of_stock" | "unknown";
  productUrl: string;
  raw: unknown;
}

export interface GenericHtmlCollectorOptions {
  requestTimeoutMs?: number;
  maxDocumentBytes?: number;
  maxProductLinks?: number;
  concurrency?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function productNodes(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(productNodes);
  if (!isRecord(value)) return [];
  const nodes = Array.isArray(value["@graph"])
    ? (value["@graph"] as unknown[]).flatMap(productNodes)
    : [];
  const type = value["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) nodes.push(value);
  return nodes;
}

function parseJsonLd(html: string, pageUrl: URL): ParsedHtmlOffer[] {
  const $ = cheerio.load(html);
  const parsed: ParsedHtmlOffer[] = [];
  $("script[type='application/ld+json']").each((_index, element) => {
    const text = $(element).text().trim();
    if (!text) return;
    try {
      for (const product of productNodes(JSON.parse(text) as unknown)) {
        const offerValue = Array.isArray(product.offers) ? product.offers[0] : product.offers;
        if (!isRecord(offerValue) || typeof product.name !== "string") continue;
        const price = offerValue.price;
        if (typeof price !== "string" && typeof price !== "number") continue;
        const productUrl =
          typeof offerValue.url === "string"
            ? new URL(offerValue.url, pageUrl).toString()
            : typeof product.url === "string"
              ? new URL(product.url, pageUrl).toString()
              : pageUrl.toString();
        const availability = String(offerValue.availability ?? "");
        const sourceItemId = new URL(productUrl).pathname.replace(/^\/+/, "") || hashPayload(product).slice(0, 20);
        parsed.push({
          sourceItemId,
          title: product.name,
          ...(typeof product.description === "string"
            ? { description: product.description }
            : {}),
          price: String(price),
          currency:
            typeof offerValue.priceCurrency === "string"
              ? offerValue.priceCurrency.toUpperCase()
              : "CNY",
          stockState: /OutOfStock/i.test(availability)
            ? "out_of_stock"
            : /InStock|LimitedAvailability/i.test(availability)
              ? "in_stock"
              : "unknown",
          productUrl,
          raw: product,
        });
      }
    } catch {
      return;
    }
  });
  return parsed;
}

function parseEmbeddedItem(html: string, pageUrl: URL): ParsedHtmlOffer[] {
  const match = html.match(/setVar\(\s*["']_var_item["']\s*,\s*(\{[^;]+\})\s*\)\s*;/);
  if (!match?.[1]) return [];
  try {
    const value = JSON.parse(match[1]) as unknown;
    if (
      !isRecord(value) ||
      (typeof value.id !== "number" && typeof value.id !== "string") ||
      typeof value.name !== "string" ||
      (typeof value.price !== "number" && typeof value.price !== "string")
    ) {
      return [];
    }
    const stockCount = typeof value.stock === "number" ? value.stock : undefined;
    const productUrl =
      typeof value.share_url === "string"
        ? new URL(value.share_url, pageUrl).toString()
        : pageUrl.toString();
    return [{
      sourceItemId: String(value.id),
      title: value.name,
      price: String(value.price),
      currency: "CNY",
      ...(stockCount !== undefined ? { stockCount } : {}),
      stockState: value.is_stock === false || stockCount === 0 ? "out_of_stock" : "in_stock",
      productUrl,
      raw: value,
    }];
  } catch {
    return [];
  }
}

function parseOffers(html: string, pageUrl: URL): ParsedHtmlOffer[] {
  const byId = new Map<string, ParsedHtmlOffer>();
  for (const offer of [...parseJsonLd(html, pageUrl), ...parseEmbeddedItem(html, pageUrl)]) {
    byId.set(offer.sourceItemId, offer);
  }
  return [...byId.values()];
}

export function extractGenericHtmlOffers(html: string, pageUrl: URL): unknown[] {
  return parseOffers(html, pageUrl);
}

function asParsedOffer(value: unknown): ParsedHtmlOffer {
  if (
    !isRecord(value) ||
    typeof value.sourceItemId !== "string" ||
    typeof value.title !== "string" ||
    typeof value.price !== "string" ||
    typeof value.currency !== "string" ||
    typeof value.productUrl !== "string"
  ) {
    throw new Error("invalid_generic_html_offer");
  }
  return value as unknown as ParsedHtmlOffer;
}

export class GenericHtmlCollector implements CollectorAdapter {
  readonly kind = "generic_html";
  readonly #requestTimeoutMs: number;
  readonly #maxDocumentBytes: number;
  readonly #maxProductLinks: number;
  readonly #concurrency: number;

  constructor(options: GenericHtmlCollectorOptions = {}) {
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 15_000;
    this.#maxDocumentBytes = options.maxDocumentBytes ?? 2_000_000;
    this.#maxProductLinks = options.maxProductLinks ?? 80;
    this.#concurrency = options.concurrency ?? 6;
  }

  async #html(url: URL, signal: AbortSignal): Promise<string> {
    const response = await fetch(url, {
      headers: { accept: "text/html", "user-agent": "AIPriceRadar/0.1" },
      signal: AbortSignal.any([signal, AbortSignal.timeout(this.#requestTimeoutMs)]),
    });
    if (!response.ok) throw new Error(`generic_html_http_${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new Error("generic_html_content_type");
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > this.#maxDocumentBytes) throw new Error("generic_html_document_too_large");
    const html = await response.text();
    if (Buffer.byteLength(html) > this.#maxDocumentBytes) {
      throw new Error("generic_html_document_too_large");
    }
    return html;
  }

  #evidence(html: string): string[] {
    const evidence: string[] = [];
    if (/application\/ld\+json/i.test(html) && /["']Product["']/i.test(html)) {
      evidence.push("json_ld_product");
    }
    if (/setVar\(\s*["']_var_item["']/i.test(html)) evidence.push("embedded_var_item");
    if (/href=["'][^"']*\/(?:item|products)\//i.test(html)) evidence.push("product_links");
    return evidence;
  }

  async probe(sourceUrl: URL, signal: AbortSignal): Promise<ProbeResult> {
    try {
      const html = await this.#html(sourceUrl, signal);
      const evidence = this.#evidence(html);
      if (evidence.length === 0) {
        return {
          supported: false,
          collectorKind: "generic_html",
          confidence: 0.1,
          evidence,
          reason: "no_machine_readable_products",
        };
      }
      const $ = cheerio.load(html);
      return {
        supported: true,
        collectorKind: "generic_html",
        confidence: evidence.includes("json_ld_product") ? 0.8 : 0.65,
        identity: {
          platformKind: "generic_html",
          platformMerchantId: sourceUrl.hostname.toLowerCase(),
          canonicalEntryUrl: new URL("/", sourceUrl.origin).toString(),
          merchantName: $("title").first().text().replace(/\s+/g, " ").trim() || sourceUrl.hostname,
        },
        evidence,
      };
    } catch (error) {
      return {
        supported: false,
        collectorKind: "generic_html",
        confidence: 0,
        evidence: [],
        reason: error instanceof Error ? error.message : "generic_html_probe_failed",
      };
    }
  }

  async resolveSourceIdentity(sourceUrl: URL, signal: AbortSignal): Promise<SourceIdentity> {
    const probe = await this.probe(sourceUrl, signal);
    if (!probe.supported || !probe.identity) throw new Error(probe.reason ?? "generic_html_unsupported");
    return probe.identity;
  }

  async fetchCatalog(
    source: SourceIdentity,
    context: CollectorContext,
    cursor?: string,
  ): Promise<CatalogPage> {
    if (cursor) throw new Error("generic_html_has_single_catalog_page");
    const entryUrl = new URL(source.canonicalEntryUrl);
    const homepage = await this.#html(entryUrl, context.signal);
    const $ = cheerio.load(homepage);
    const links = new Set<string>();
    $("a[href]").each((_index, element) => {
      const href = $(element).attr("href");
      if (!href) return;
      try {
        const url = new URL(href, entryUrl);
        if (url.origin === entryUrl.origin && /^\/(?:item|products)\//.test(url.pathname)) {
          links.add(url.toString());
        }
      } catch {
        return;
      }
    });

    const offers = parseOffers(homepage, entryUrl);
    const targets = [...links].slice(0, this.#maxProductLinks);
    for (let offset = 0; offset < targets.length; offset += this.#concurrency) {
      const batch = targets.slice(offset, offset + this.#concurrency);
      const results = await Promise.all(
        batch.map(async (target) => {
          try {
            const targetUrl = new URL(target);
            const html = await this.#html(targetUrl, context.signal);
            return parseOffers(html, targetUrl);
          } catch (error) {
            return [{
              __error: error instanceof Error ? error.message : "item_fetch_failed",
              __url: target,
            }];
          }
        }),
      );
      for (const result of results) offers.push(...(result as ParsedHtmlOffer[]));
    }

    return {
      items: offers,
      cursor: "1",
      expectedTotal: offers.length,
      rawPayloadHash: hashPayload({ homepage: hashPayload(homepage), links: targets }),
    };
  }

  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation {
    const issues: SnapshotValidation["issues"] = [];
    const ids = new Set<string>();
    let parsedTotal = 0;
    let duplicateTotal = 0;
    for (const page of pages) {
      for (const input of page.items) {
        try {
          const item = asParsedOffer(input);
          parsedTotal += 1;
          if (ids.has(item.sourceItemId)) duplicateTotal += 1;
          ids.add(item.sourceItemId);
        } catch {
          issues.push({ code: "item_fetch_or_parse_failed", message: "A linked product could not be parsed.", severity: "error" });
        }
      }
    }
    if (parsedTotal === 0) {
      issues.push({ code: "empty_html_catalog", message: "No public product facts were found.", severity: "error" });
    }
    if (duplicateTotal > 0) {
      issues.push({ code: "duplicate_item_ids", message: `${duplicateTotal} duplicate HTML products.`, severity: "error" });
    }
    const completeSnapshot = issues.every((issue) => issue.severity !== "error");
    return {
      status: completeSnapshot ? "success" : parsedTotal > 0 ? "partial" : "failed",
      completeSnapshot,
      expectedTotal: pages.reduce((sum, page) => sum + page.items.length, 0),
      fetchedTotal: pages.reduce((sum, page) => sum + page.items.length, 0),
      parsedTotal,
      duplicateTotal,
      issues,
    };
  }

  normalizeItem(input: unknown, context: CollectorContext): RawOfferInput {
    const item = asParsedOffer(input);
    return rawOfferInputSchema.parse({
      sourceItemId: item.sourceItemId,
      rawTitle: item.title,
      ...(item.description ? { rawDescription: item.description } : {}),
      rawPriceText: item.price,
      price: item.price,
      currency: item.currency,
      rawStock: item.raw,
      ...(item.stockCount !== undefined ? { stockCount: item.stockCount } : {}),
      stockState: item.stockState,
      productUrl: item.productUrl,
      capturedAt: context.now.toISOString(),
      rawPayloadHash: hashPayload(item.raw),
    });
  }
}
