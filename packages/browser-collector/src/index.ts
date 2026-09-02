import { createHash } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import type { CollectorAdapter, CollectorContext } from "@price-radar/collector-sdk";
import {
  extractGenericHtmlOffers,
  GenericHtmlCollector,
} from "@price-radar/generic-html-collector";
import type {
  CatalogPage,
  ProbeResult,
  RawOfferInput,
  SnapshotValidation,
  SourceIdentity,
} from "@price-radar/schema";

export interface BrowserCollectorOptions {
  navigationTimeoutMs?: number;
  maxProductLinks?: number;
  concurrency?: number;
  executablePath?: string;
}

function hashPayload(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export class BrowserCollector implements CollectorAdapter {
  readonly kind = "browser";
  readonly probePriority = "browser" as const;
  readonly #navigationTimeoutMs: number;
  readonly #maxProductLinks: number;
  readonly #concurrency: number;
  readonly #executablePath: string | undefined;
  readonly #htmlDelegate = new GenericHtmlCollector();

  constructor(options: BrowserCollectorOptions = {}) {
    this.#navigationTimeoutMs = options.navigationTimeoutMs ?? 20_000;
    this.#maxProductLinks = options.maxProductLinks ?? 60;
    this.#concurrency = options.concurrency ?? 4;
    this.#executablePath = options.executablePath;
  }

  async #context(): Promise<BrowserContext> {
    const browser = await chromium.launch({
      headless: true,
      ...(this.#executablePath ? { executablePath: this.#executablePath } : {}),
    });
    const context = await browser.newContext({
      acceptDownloads: false,
      javaScriptEnabled: true,
      serviceWorkers: "block",
    });
    await context.route("**/*", async (route) => {
      const type = route.request().resourceType();
      if (["image", "media", "font"].includes(type)) await route.abort();
      else await route.continue();
    });
    return context;
  }

  async #render(page: Page, url: string): Promise<string> {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.#navigationTimeoutMs,
    });
    await page.waitForLoadState("networkidle", { timeout: 4_000 }).catch(() => undefined);
    return page.content();
  }

  async probe(sourceUrl: URL, _signal: AbortSignal): Promise<ProbeResult> {
    let context: BrowserContext | undefined;
    try {
      context = await this.#context();
      const page = await context.newPage();
      const html = await this.#render(page, sourceUrl.toString());
      const offers = extractGenericHtmlOffers(html, sourceUrl);
      const productLinks = await page.locator("a[href*='/item/'], a[href*='/products/']").count();
      if (offers.length === 0 && productLinks === 0) {
        return {
          supported: false,
          collectorKind: "browser",
          confidence: 0.1,
          evidence: ["javascript_rendered"],
          reason: "rendered_page_has_no_products",
        };
      }
      return {
        supported: true,
        collectorKind: "browser",
        confidence: 0.55,
        identity: {
          platformKind: "browser",
          platformMerchantId: sourceUrl.hostname.toLowerCase(),
          canonicalEntryUrl: new URL("/", sourceUrl.origin).toString(),
          merchantName: (await page.title()).trim() || sourceUrl.hostname,
        },
        evidence: ["javascript_rendered", offers.length > 0 ? "rendered_product_data" : "rendered_product_links"],
      };
    } catch (error) {
      return {
        supported: false,
        collectorKind: "browser",
        confidence: 0,
        evidence: [],
        reason: error instanceof Error ? error.message : "browser_probe_failed",
      };
    } finally {
      await context?.browser()?.close();
    }
  }

  async resolveSourceIdentity(sourceUrl: URL, signal: AbortSignal): Promise<SourceIdentity> {
    const probe = await this.probe(sourceUrl, signal);
    if (!probe.supported || !probe.identity) throw new Error(probe.reason ?? "browser_unsupported");
    return probe.identity;
  }

  async fetchCatalog(
    source: SourceIdentity,
    _collectorContext: CollectorContext,
    cursor?: string,
  ): Promise<CatalogPage> {
    if (cursor) throw new Error("browser_collector_has_single_page");
    const entryUrl = new URL(source.canonicalEntryUrl);
    const context = await this.#context();
    try {
      const page = await context.newPage();
      const homepage = await this.#render(page, entryUrl.toString());
      const offers = extractGenericHtmlOffers(homepage, entryUrl);
      const links = await page
        .locator("a[href*='/item/'], a[href*='/products/']")
        .evaluateAll((elements, origin) => {
          const urls = new Set<string>();
          for (const element of elements) {
            const href = element.getAttribute("href");
            if (!href) continue;
            try {
              const url = new URL(href, String(origin));
              if (url.origin === origin && /^\/(?:item|products)\//.test(url.pathname)) {
                urls.add(url.toString());
              }
            } catch {
              continue;
            }
          }
          return [...urls];
        }, entryUrl.origin);
      const targets = links.slice(0, this.#maxProductLinks);

      for (let offset = 0; offset < targets.length; offset += this.#concurrency) {
        const batch = targets.slice(offset, offset + this.#concurrency);
        const results = await Promise.all(
          batch.map(async (target) => {
            const itemPage = await context.newPage();
            try {
              const html = await this.#render(itemPage, target);
              return extractGenericHtmlOffers(html, new URL(target));
            } catch (error) {
              return [{
                __error: error instanceof Error ? error.message : "browser_item_failed",
                __url: target,
              }];
            } finally {
              await itemPage.close();
            }
          }),
        );
        for (const result of results) offers.push(...result);
      }

      return {
        items: offers,
        cursor: "1",
        expectedTotal: offers.length,
        rawPayloadHash: hashPayload({ homepage: hashPayload(homepage), links: targets }),
      };
    } finally {
      await context.browser()?.close();
    }
  }

  validateSnapshot(pages: readonly CatalogPage[]): SnapshotValidation {
    return this.#htmlDelegate.validateSnapshot(pages);
  }

  normalizeItem(item: unknown, context: CollectorContext): RawOfferInput {
    return this.#htmlDelegate.normalizeItem(item, context);
  }
}
