import { and, eq, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { transitModelPrices, transitProbes, transitProviders } from "@price-radar/database";
import type * as schema from "@price-radar/database/schema";
import { assertSafePublicUrl } from "./url-security.js";

// The transit sweep runs on a single client under its advisory lock, not on the pool.
type Database = NodePgDatabase<typeof schema>;

// Self-hosted API relays. Two open-source systems run most of them, and both publish their
// prices without an account: New API at /api/status and /api/pricing, Sub2API at
// /api/v1/settings/public and /api/v1/model-plaza. A relay that hides either is not listed.

export type StationSystem = "new_api" | "sub2api";

export interface StationModelPrice {
  modelCode: string;
  /** Real US dollars per million input tokens, after group and top-up discounts. */
  inputPerMillion: number;
  outputPerMillion: number | null;
  /** What the relay charges as a share of the official list price. */
  multiplier: number;
  group: string;
}

export interface StationSnapshot {
  system: StationSystem;
  name: string;
  version: string | null;
  /** Yuan paid per dollar of balance, divided by the yuan-dollar rate; null when unpublished. */
  topUpRatio: number | null;
  groups: Array<{ name: string; ratio: number }>;
  models: StationModelPrice[];
  pricingUrl: string;
  statusUrl: string;
}

export interface StationFetchResult { status: number; payload: unknown; latencyMs: number }
export type StationFetcher = (url: string) => Promise<StationFetchResult>;

// Groups an operator keeps for itself or for testing ("测试 0.001", "Adm内测 10") would
// otherwise set a relay's headline price.
const PRIVATE_GROUP = /测试|内测|test|adm(?:in)?/i;
// New API counts model_ratio 1 as $0.002 per thousand input tokens.
const NEW_API_DOLLARS_PER_MILLION_AT_RATIO_ONE = 2;

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const positive = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const round = (value: number, digits = 6) => Number(value.toFixed(digits));

export function parseNewApiStation(status: unknown, pricing: unknown, origin: string): StationSnapshot | null {
  const statusBody = record(status);
  const info = record(statusBody.data);
  if (statusBody.success !== true || !Object.keys(info).length) return null;
  const pricingBody = record(pricing);
  const rows = Array.isArray(pricingBody.data) ? pricingBody.data.map(record) : [];
  if (pricingBody.success === false || !rows.length) return null;
  const price = positive(info.price);
  const usdRate = positive(info.usd_exchange_rate);
  const topUpRatio = price && usdRate ? round(price / usdRate) : null;
  const groupRatios = Object.entries(record(pricingBody.group_ratio))
    .map(([name, ratio]) => ({ name, ratio: positive(ratio) }))
    .filter((group): group is { name: string; ratio: number } => group.ratio !== null && !PRIVATE_GROUP.test(group.name));
  const models: StationModelPrice[] = [];
  for (const row of rows) {
    const modelCode = typeof row.model_name === "string" ? row.model_name.trim() : "";
    const modelRatio = positive(row.model_ratio);
    // quota_type 1 is a fixed price per call; it has no token rate to compare.
    if (!modelCode || Number(row.quota_type ?? 0) !== 0 || !modelRatio) continue;
    const enabled = Array.isArray(row.enable_groups) ? row.enable_groups.map(String) : [];
    const candidates = groupRatios.filter(group => !enabled.length || enabled.includes(group.name));
    const group = candidates.sort((left, right) => left.ratio - right.ratio)[0];
    if (!group) continue;
    const discount = group.ratio * (topUpRatio ?? 1);
    const input = modelRatio * NEW_API_DOLLARS_PER_MILLION_AT_RATIO_ONE * discount;
    const completionRatio = positive(row.completion_ratio);
    models.push({
      modelCode, group: group.name, multiplier: round(discount),
      inputPerMillion: round(input, 8), outputPerMillion: completionRatio ? round(input * completionRatio, 8) : null,
    });
  }
  if (!models.length) return null;
  return {
    system: "new_api",
    name: typeof info.system_name === "string" && info.system_name.trim() ? info.system_name.trim() : new URL(origin).hostname,
    version: typeof info.version === "string" && info.version ? info.version : null,
    topUpRatio, groups: groupRatios, models,
    pricingUrl: `${origin}/api/pricing`, statusUrl: `${origin}/api/status`,
  };
}

export function parseSub2ApiStation(settings: unknown, plaza: unknown, origin: string): StationSnapshot | null {
  const info = record(record(settings).data);
  const plazaData = record(record(plaza).data);
  const groups = Array.isArray(plazaData.groups) ? plazaData.groups.map(record) : [];
  if (!Object.keys(info).length || !groups.length) return null;
  const best = new Map<string, StationModelPrice>();
  const usableGroups: Array<{ name: string; ratio: number }> = [];
  for (const group of groups) {
    const name = typeof group.name === "string" ? group.name : "";
    const ratio = positive(group.rate_multiplier);
    if (!name || !ratio || group.is_exclusive === true || PRIVATE_GROUP.test(name)) continue;
    usableGroups.push({ name, ratio });
    for (const model of Array.isArray(group.models) ? group.models.map(record) : []) {
      const modelCode = typeof model.name === "string" ? model.name.trim() : "";
      const pricing = record(model.pricing);
      const official = record(model.official_pricing);
      const input = positive(pricing.input_price);
      if (!modelCode || pricing.billing_mode !== "token" || !input) continue;
      const officialInput = positive(official.input_price);
      const modelShare = officialInput ? input / officialInput : 1;
      const multiplier = ratio * modelShare;
      const output = positive(pricing.output_price);
      const candidate: StationModelPrice = {
        modelCode, group: name, multiplier: round(multiplier),
        inputPerMillion: round(input * 1_000_000 * ratio, 8),
        outputPerMillion: output ? round(output * 1_000_000 * ratio, 8) : null,
      };
      const current = best.get(modelCode);
      if (!current || candidate.multiplier < current.multiplier) best.set(modelCode, candidate);
    }
  }
  if (!best.size) return null;
  return {
    system: "sub2api",
    name: typeof info.site_name === "string" && info.site_name.trim() ? info.site_name.trim() : new URL(origin).hostname,
    version: typeof info.version === "string" && info.version ? info.version : null,
    // Sub2API does not publish what a dollar of balance costs; the multiplier is the group rate alone.
    topUpRatio: null, groups: usableGroups, models: [...best.values()],
    pricingUrl: `${origin}/api/v1/model-plaza`, statusUrl: `${origin}/api/v1/settings/public`,
  };
}

async function fetchPublicJson(url: string): Promise<StationFetchResult> {
  await assertSafePublicUrl(url);
  const started = performance.now();
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(12_000),
    headers: { accept: "application/json", "user-agent": "AIPriceRadar/0.1 (+public-price-verification)" },
  });
  const text = await response.text();
  if (text.length > 4_000_000) throw new Error("station_response_too_large");
  let payload: unknown = null;
  try { payload = JSON.parse(text); } catch { payload = null; }
  return { status: response.status, payload, latencyMs: Math.round(performance.now() - started) };
}

/** Reads one relay's public prices, trying New API first and Sub2API second. */
export async function readStation(origin: string, fetchJson: StationFetcher = fetchPublicJson): Promise<{ snapshot: StationSnapshot | null; latencyMs: number; reason?: string }> {
  const status = await fetchJson(`${origin}/api/status`).catch(() => null);
  if (status?.status === 200 && record(status.payload).success === true) {
    const pricing = await fetchJson(`${origin}/api/pricing`).catch(() => null);
    const snapshot = pricing?.status === 200 ? parseNewApiStation(status.payload, pricing.payload, origin) : null;
    return snapshot ? { snapshot, latencyMs: status.latencyMs } : { snapshot: null, latencyMs: status.latencyMs, reason: "new_api_pricing_not_public" };
  }
  const settings = await fetchJson(`${origin}/api/v1/settings/public`).catch(() => null);
  const settingsData = record(record(settings?.payload).data);
  if (settings?.status === 200 && Object.keys(settingsData).length) {
    if (settingsData.model_plaza_enabled !== true || settingsData.model_plaza_require_auth === true) {
      return { snapshot: null, latencyMs: settings.latencyMs, reason: "sub2api_model_plaza_not_public" };
    }
    const plaza = await fetchJson(`${origin}/api/v1/model-plaza`).catch(() => null);
    const snapshot = plaza?.status === 200 ? parseSub2ApiStation(settings.payload, plaza.payload, origin) : null;
    return snapshot ? { snapshot, latencyMs: settings.latencyMs } : { snapshot: null, latencyMs: settings.latencyMs, reason: "sub2api_prices_unreadable" };
  }
  return { snapshot: null, latencyMs: status?.latencyMs ?? settings?.latencyMs ?? 0, reason: "unsupported_system" };
}

// Hosts that appear in relay listings but are documentation, chat or shop platforms.
const NOT_A_STATION = /(?:^|\.)(?:wzyp\.cn|catfk\.com|16688\.com\.cn|t\.me|qq\.com|weixin\.qq\.com|github\.com|githubusercontent\.com|chatgpt\.com|openai\.com|anthropic\.com|claude\.ai|google\.com|feishu\.cn|larksuite\.com|notion\.site|bilibili\.com|youtube\.com|x\.com|twitter\.com|baidu\.com|cloudflare\.com|discord\.gg|discord\.com)$/i;
const HOST_PATTERN = /(?:https?:\/\/)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})(?=[\/:\s，。）)\]】"'<>|｜]|$)/gi;
const DOC_SUBDOMAIN = /^(?:doc|docs|help|know|bak|blog|wiki|status)\./i;
const FILE_SUFFIX = /\.(?:exe|zip|png|jpe?g|gif|pdf|apk|dmg|key|md|txt|html?|php|js|css)$/i;

/** Relay hosts named in the listings of shops that sell relay balance. */
export function extractStationHosts(texts: readonly string[]): string[] {
  const hosts = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(HOST_PATTERN)) {
      const host = match[1]!.toLowerCase().replace(/^www\./, "");
      if (NOT_A_STATION.test(host) || DOC_SUBDOMAIN.test(host) || FILE_SUFFIX.test(host) || !host.includes(".")) continue;
      hosts.add(host);
    }
  }
  return [...hosts].sort();
}

export function stationSlug(host: string): string {
  return `relay-${host.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
}

async function saveStation(db: Database, host: string, origin: string, snapshot: StationSnapshot, latencyMs: number, checkedAt: Date) {
  const [provider] = await db.insert(transitProviders).values({
    slug: stationSlug(host), displayName: snapshot.name, websiteUrl: `${origin}/`, apiBaseUrl: `${origin}/v1`,
    modelsEndpoint: snapshot.pricingUrl, statusUrl: snapshot.statusUrl, systemKind: snapshot.system,
    discoverySource: "relay_balance_listing", evidenceUrl: snapshot.pricingUrl, active: true,
  }).onConflictDoUpdate({
    target: transitProviders.slug,
    set: { displayName: snapshot.name, modelsEndpoint: snapshot.pricingUrl, statusUrl: snapshot.statusUrl,
      systemKind: snapshot.system, evidenceUrl: snapshot.pricingUrl, active: true, updatedAt: checkedAt },
  }).returning({ id: transitProviders.id });
  if (!provider) throw new Error("transit_station_upsert_failed");
  const plan = { topUpRatio: snapshot.topUpRatio, groups: snapshot.groups, version: snapshot.version };
  for (const model of snapshot.models) {
    const values = {
      displayName: model.modelCode, currency: "USD", unit: "per_million_tokens",
      inputPrice: model.inputPerMillion.toFixed(8), outputPrice: model.outputPerMillion === null ? null : model.outputPerMillion.toFixed(8),
      multiplier: model.multiplier.toFixed(6), fixedPlan: { ...plan, group: model.group },
      evidenceKind: "provider_self_reported", evidenceUrl: snapshot.pricingUrl, verifiedAt: checkedAt,
    };
    await db.insert(transitModelPrices).values({ providerId: provider.id, modelCode: model.modelCode, ...values })
      .onConflictDoUpdate({ target: [transitModelPrices.providerId, transitModelPrices.modelCode], set: { ...values, updatedAt: checkedAt } });
  }
  // A model the relay no longer lists is no longer for sale there.
  await db.delete(transitModelPrices).where(and(eq(transitModelPrices.providerId, provider.id),
    notInArray(transitModelPrices.modelCode, snapshot.models.map(model => model.modelCode))));
  await db.insert(transitProbes).values({ providerId: provider.id, probeKind: "public_pricing", success: true, latencyMs,
    httpStatus: 200, modelCount: snapshot.models.length, evidence: { endpoint: snapshot.pricingUrl, system: snapshot.system }, checkedAt });
}

async function recordUnsupported(db: Database, host: string, origin: string, reason: string, latencyMs: number, checkedAt: Date) {
  // Kept inactive so the same host is not probed every day; it never reaches the public list.
  const [provider] = await db.insert(transitProviders).values({
    slug: stationSlug(host), displayName: host, websiteUrl: `${origin}/`, systemKind: "unsupported",
    discoverySource: "relay_balance_listing", evidenceUrl: `${origin}/`, active: false,
  }).onConflictDoUpdate({ target: transitProviders.slug, set: { active: false, updatedAt: checkedAt } })
    .returning({ id: transitProviders.id });
  if (provider) await db.insert(transitProbes).values({ providerId: provider.id, probeKind: "public_pricing", success: false,
    latencyMs, errorCode: reason, evidence: { origin }, checkedAt });
}

export interface StationSweepResult { known: number; probed: number; listed: number; unsupported: number; failed: number }

/**
 * Refreshes every listed relay and probes hosts newly named by relay-balance listings.
 * Unsupported hosts are retried after a week; listed relays that fail keep their last
 * prices and show the failure in their stability record.
 */
/** Relay hosts named by the currently published relay-balance listings. */
export async function namedRelayHosts(db: Database): Promise<string[]> {
  const listings = await db.execute<{ text: string }>(sql`
    select concat_ws(' ', ros.raw_title, ros.raw_description) as text
      from offers o
      join publication_channels pc on pc.current_generation_id=o.publish_generation_id and pc.channel='card_prices'
      join canonical_products cp on cp.id=o.canonical_product_id and cp.slug='api-transit-credit'
      join raw_offer_snapshots ros on ros.id=o.latest_raw_snapshot_id`);
  return extractStationHosts(listings.rows.map(row => row.text));
}

export async function refreshTransitStations(db: Database, options: { maxNewHosts?: number; fetchJson?: StationFetcher; now?: Date; namedHosts?: string[] } = {}): Promise<StationSweepResult> {
  const now = options.now ?? new Date();
  const named = options.namedHosts ?? await namedRelayHosts(db);
  const known = await db.select({ slug: transitProviders.slug, active: transitProviders.active, websiteUrl: transitProviders.websiteUrl,
    updatedAt: transitProviders.updatedAt }).from(transitProviders).where(eq(transitProviders.discoverySource, "relay_balance_listing"));
  const bySlug = new Map(known.map(row => [row.slug, row]));
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const listedHosts = known.filter(row => row.active).map(row => new URL(row.websiteUrl).hostname);
  const freshHosts = named.filter(host => {
    const row = bySlug.get(stationSlug(host));
    return !row || (!row.active && row.updatedAt.getTime() < weekAgo);
  }).slice(0, options.maxNewHosts ?? 40);
  const result: StationSweepResult = { known: listedHosts.length, probed: 0, listed: 0, unsupported: 0, failed: 0 };
  for (const host of [...new Set([...listedHosts, ...freshHosts])]) {
    const origin = `https://${host}`;
    result.probed++;
    try {
      const { snapshot, latencyMs, reason } = await readStation(origin, options.fetchJson);
      if (snapshot) { await saveStation(db, host, origin, snapshot, latencyMs, now); result.listed++; }
      else if (bySlug.get(stationSlug(host))?.active) {
        const [provider] = await db.select({ id: transitProviders.id }).from(transitProviders).where(eq(transitProviders.slug, stationSlug(host)));
        if (provider) await db.insert(transitProbes).values({ providerId: provider.id, probeKind: "public_pricing", success: false, latencyMs, errorCode: reason ?? "unreadable", evidence: { origin }, checkedAt: now });
        result.failed++;
      } else { await recordUnsupported(db, host, origin, reason ?? "unsupported_system", latencyMs, now); result.unsupported++; }
    } catch (error) {
      result.failed++;
      const listed = bySlug.get(stationSlug(host))?.active;
      if (listed) {
        const [provider] = await db.select({ id: transitProviders.id }).from(transitProviders).where(eq(transitProviders.slug, stationSlug(host)));
        if (provider) await db.insert(transitProbes).values({ providerId: provider.id, probeKind: "public_pricing", success: false,
          errorCode: error instanceof Error ? error.message.slice(0, 120) : "probe_failed", evidence: { origin }, checkedAt: now }).catch(() => undefined);
      } else {
        await recordUnsupported(db, host, origin, error instanceof Error ? error.message.slice(0, 120) : "probe_failed", 0, now).catch(() => undefined);
      }
    }
  }
  return result;
}
