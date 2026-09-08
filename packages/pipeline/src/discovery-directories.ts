import { hostThrottle } from "@price-radar/collector-sdk";
import type { Database } from "@price-radar/database";
import { lastSuccessfulDiscoveryAt, recordDiscoveryRun, type CandidateLead } from "./candidates.js";

/**
 * Public shop directories maintained by other comparison sites. They are read
 * only to learn *where shops are*; every price we publish still comes from our
 * own crawl of the shop's public API. The lead carries the directory page as
 * its discovery evidence so operators can see which listings mentioned a shop.
 */
export interface DirectoryProvider {
  id: string;
  label: string;
  homepage: string;
  fetchLeads(signal: AbortSignal): Promise<CandidateLead[]>;
}

const USER_AGENT = "AIPriceRadar/0.1 (+source-directory-import; shop URLs only)";
const MAX_BYTES = 12_000_000;

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const target = new URL(url);
  return hostThrottle.run(target.hostname, async () => {
    const response = await fetch(target, {
      redirect: "follow",
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    });
    if (!response.ok) throw new Error(`directory_http_${response.status}:${target.hostname}`);
    const text = await response.text();
    if (text.length > MAX_BYTES) throw new Error(`directory_too_large:${target.hostname}`);
    return JSON.parse(text) as unknown;
  }, signal);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** PriceAI `/api/merchants` rows: `shopUrl`/`entryUrl` plus the store name. */
export function parsePriceAiMerchants(payload: unknown, pageUrl: string): CandidateLead[] {
  const rows = isRecord(payload) && Array.isArray(payload.rows) ? payload.rows : [];
  const leads: CandidateLead[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const url = text(row.shopUrl) ?? text(row.entryUrl);
    if (!url) continue;
    const nameHint = text(row.storeName) ?? text(row.name) ?? text(row.sourceName);
    leads.push({ url, provider: "priceai_merchants", discoveryKind: "directory", discoveryUrl: pageUrl, ...(nameHint ? { nameHint } : {}) });
  }
  return leads;
}

/** AI号探 `/api/shops`: flat array of LDXP shops with `url`, `name`, `platform`. */
export function parseAihaotanShops(payload: unknown, pageUrl: string): CandidateLead[] {
  if (!Array.isArray(payload)) return [];
  const leads: CandidateLead[] = [];
  for (const row of payload) {
    if (!isRecord(row)) continue;
    const url = text(row.url);
    if (!url) continue;
    const nameHint = text(row.name);
    leads.push({ url, provider: "aihaotan_shops", discoveryKind: "directory", discoveryUrl: pageUrl, ...(nameHint ? { nameHint } : {}) });
  }
  return leads;
}

/** CardNav `/api/shop-products.json`: packed arrays, `s` holds `[id, name, url, refreshedAt, score, sponsor]`. */
export function parseCardnavShopProducts(payload: unknown, pageUrl: string): CandidateLead[] {
  const sites = isRecord(payload) && Array.isArray(payload.s) ? payload.s : [];
  const leads: CandidateLead[] = [];
  for (const site of sites) {
    if (!Array.isArray(site)) continue;
    const url = site.find((value) => typeof value === "string" && /^https?:\/\//.test(value));
    if (typeof url !== "string") continue;
    const nameHint = typeof site[1] === "string" && site[1] !== url ? site[1].trim() : undefined;
    leads.push({ url, provider: "cardnav_shop_products", discoveryKind: "directory", discoveryUrl: pageUrl, ...(nameHint ? { nameHint } : {}) });
  }
  return leads;
}

/** Aibijia `products.json`: offers link to single items; the shop token is resolved when vetted. */
export function parseAibijiaProducts(payload: unknown, pageUrl: string): CandidateLead[] {
  const products = isRecord(payload) && Array.isArray(payload.products) ? payload.products : Array.isArray(payload) ? payload : [];
  const leads: CandidateLead[] = [];
  for (const product of products) {
    if (!isRecord(product) || !Array.isArray(product.offers)) continue;
    for (const offer of product.offers) {
      if (!isRecord(offer)) continue;
      const url = text(offer.url);
      if (!url) continue;
      const nameHint = text(offer.source_store_name);
      leads.push({ url, provider: "aibijia_products", discoveryKind: "directory", discoveryUrl: pageUrl, ...(nameHint ? { nameHint } : {}) });
    }
  }
  return leads;
}

export const DIRECTORY_PROVIDERS: readonly DirectoryProvider[] = [
  {
    id: "priceai_merchants",
    label: "PriceAI 商家目录",
    homepage: "https://priceai.cc/channels",
    async fetchLeads(signal) {
      const leads: CandidateLead[] = [];
      const limit = 200;
      for (let offset = 0, page = 0; page < 10; offset += limit, page += 1) {
        const pageUrl = `https://priceai.cc/api/merchants?limit=${limit}&offset=${offset}`;
        const payload = await fetchJson(pageUrl, signal);
        const pageLeads = parsePriceAiMerchants(payload, pageUrl);
        leads.push(...pageLeads);
        const total = isRecord(payload) && typeof payload.total === "number" ? payload.total : undefined;
        const rows = isRecord(payload) && Array.isArray(payload.rows) ? payload.rows.length : 0;
        if (rows < limit || (total !== undefined && offset + limit >= total)) break;
      }
      return leads;
    },
  },
  {
    id: "aihaotan_shops",
    label: "AI号探 店铺列表",
    homepage: "https://www.aihaotan.com/",
    async fetchLeads(signal) {
      const pageUrl = "https://www.aihaotan.com/api/shops";
      return parseAihaotanShops(await fetchJson(pageUrl, signal), pageUrl);
    },
  },
  {
    id: "cardnav_shop_products",
    label: "卡网大全 商家数据",
    homepage: "https://cardnav.xyz/shops",
    async fetchLeads(signal) {
      const pageUrl = "https://cardnav.xyz/api/shop-products.json";
      return parseCardnavShopProducts(await fetchJson(pageUrl, signal), pageUrl);
    },
  },
  {
    id: "aibijia_products",
    label: "Aibijia 报价快照",
    homepage: "https://aibijia.org/",
    async fetchLeads(signal) {
      const pageUrl = "https://data.aibijia.org/products.json";
      return parseAibijiaProducts(await fetchJson(pageUrl, signal), pageUrl);
    },
  },
];

export function selectDirectoryProviders(env: NodeJS.ProcessEnv = process.env): DirectoryProvider[] {
  const raw = env.SOURCE_DIRECTORY_PROVIDERS;
  if (raw === undefined || raw.trim() === "") return [...DIRECTORY_PROVIDERS];
  const wanted = new Set(raw.split(",").map((item) => item.trim()).filter(Boolean));
  return DIRECTORY_PROVIDERS.filter((provider) => wanted.has(provider.id));
}

export interface DirectoryImportOptions {
  providers?: DirectoryProvider[];
  signal?: AbortSignal;
  /** Skip providers whose last successful import is younger than this. */
  minIntervalMs?: number;
  now?: Date;
}

export interface DirectoryImportResult {
  provider: string;
  status: "success" | "skipped" | "failed";
  resultCount?: number;
  candidateCount?: number;
  merged?: number;
  skippedKnownSource?: number;
  error?: string;
}

/** Imports every configured directory, one discovery run per provider. Failures never stop the others. */
export async function importSourceDirectories(db: Database, options: DirectoryImportOptions = {}): Promise<DirectoryImportResult[]> {
  const providers = options.providers ?? selectDirectoryProviders();
  const signal = options.signal ?? new AbortController().signal;
  const now = options.now ?? new Date();
  const results: DirectoryImportResult[] = [];
  for (const provider of providers) {
    if (options.minIntervalMs) {
      const last = await lastSuccessfulDiscoveryAt(db, provider.id);
      if (last && now.getTime() - last.getTime() < options.minIntervalMs) {
        results.push({ provider: provider.id, status: "skipped" });
        continue;
      }
    }
    try {
      const run = await recordDiscoveryRun(db, { kind: "directory", query: provider.homepage, provider: provider.id }, () => provider.fetchLeads(signal));
      results.push({ provider: provider.id, status: "success", resultCount: run.resultCount, candidateCount: run.candidateCount, merged: run.summary.merged, skippedKnownSource: run.summary.skippedKnownSource });
    } catch (error) {
      results.push({ provider: provider.id, status: "failed", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}
