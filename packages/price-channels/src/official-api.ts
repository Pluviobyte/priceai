import { createHash } from "node:crypto";
import {
  officialApiModels,
  officialApiPriceHistory,
  officialApiPrices,
  officialApiVendors,
  type Database,
} from "@price-radar/database";
import { and, eq } from "drizzle-orm";

interface VendorSeed {
  slug: string;
  displayName: string;
  pricingUrl: string;
  modelsUrl: string;
}

interface ApiPriceSeed {
  vendor: string;
  modelCode: string;
  displayName: string;
  modality: string;
  contextWindow?: number;
  availability?: string;
  priceTier?: string;
  unit: string;
  currency?: string;
  inputPrice?: number;
  cachedInputPrice?: number;
  outputPrice?: number;
  additionalPrices?: Record<string, unknown>;
  freeTier?: Record<string, unknown>;
  rateLimits?: Record<string, unknown>;
  evidenceUrl: string;
  documentVersion?: string;
}

const VENDORS: readonly VendorSeed[] = [
  { slug: "openai", displayName: "OpenAI", pricingUrl: "https://developers.openai.com/api/docs/models/compare", modelsUrl: "https://developers.openai.com/api/docs/models" },
  { slug: "anthropic", displayName: "Anthropic", pricingUrl: "https://platform.claude.com/docs/en/about-claude/pricing", modelsUrl: "https://platform.claude.com/docs/en/about-claude/models/overview" },
  { slug: "google", displayName: "Google", pricingUrl: "https://ai.google.dev/gemini-api/docs/pricing", modelsUrl: "https://ai.google.dev/gemini-api/docs/models" },
  { slug: "xai", displayName: "SpaceXAI", pricingUrl: "https://docs.x.ai/developers/models", modelsUrl: "https://docs.x.ai/developers/models" },
];

const API_PRICES: readonly ApiPriceSeed[] = [
  { vendor: "openai", modelCode: "gpt-5.6-sol", displayName: "GPT-5.6 Sol", modality: "text,image_input", contextWindow: 1_050_000, unit: "per_million_tokens", inputPrice: 4, cachedInputPrice: 0.4, outputPrice: 20, freeTier: { available: false }, rateLimits: { tier1: { rpm: 500, tpm: 500_000, batchQueue: 1_500_000 } }, evidenceUrl: "https://developers.openai.com/api/docs/models/gpt-5.6-sol", documentVersion: "verified-2026-09-03" },
  { vendor: "openai", modelCode: "gpt-5.6-terra", displayName: "GPT-5.6 Terra", modality: "text,image_input", contextWindow: 1_050_000, unit: "per_million_tokens", inputPrice: 2, cachedInputPrice: 0.2, outputPrice: 12, freeTier: { available: false }, evidenceUrl: "https://developers.openai.com/api/docs/models/compare", documentVersion: "verified-2026-09-03" },
  { vendor: "openai", modelCode: "gpt-5.6-luna", displayName: "GPT-5.6 Luna", modality: "text,image_input", contextWindow: 1_050_000, unit: "per_million_tokens", inputPrice: 0.2, cachedInputPrice: 0.02, outputPrice: 1.2, freeTier: { available: false }, evidenceUrl: "https://developers.openai.com/api/docs/models/compare", documentVersion: "verified-2026-09-03" },
  { vendor: "anthropic", modelCode: "claude-opus-4-8", displayName: "Claude Opus 4.8", modality: "text,image_input", contextWindow: 1_000_000, unit: "per_million_tokens", inputPrice: 5, cachedInputPrice: 0.5, outputPrice: 25, additionalPrices: { cacheWrite5m: 6.25, cacheWrite1h: 10 }, freeTier: { available: false }, evidenceUrl: "https://platform.claude.com/docs/en/about-claude/pricing", documentVersion: "verified-2026-09-03" },
  { vendor: "anthropic", modelCode: "claude-sonnet-5", displayName: "Claude Sonnet 5", modality: "text,image_input", unit: "per_million_tokens", inputPrice: 3, cachedInputPrice: 0.3, outputPrice: 15, additionalPrices: { cacheWrite5m: 3.75, cacheWrite1h: 6 }, freeTier: { available: false }, evidenceUrl: "https://platform.claude.com/docs/en/about-claude/pricing", documentVersion: "effective-2026-09-01" },
  { vendor: "anthropic", modelCode: "claude-haiku-4-5", displayName: "Claude Haiku 4.5", modality: "text,image_input", unit: "per_million_tokens", inputPrice: 1, cachedInputPrice: 0.1, outputPrice: 5, additionalPrices: { cacheWrite5m: 1.25, cacheWrite1h: 2 }, freeTier: { available: false }, evidenceUrl: "https://platform.claude.com/docs/en/about-claude/pricing", documentVersion: "verified-2026-09-03" },
  { vendor: "anthropic", modelCode: "claude-opus-4-8", displayName: "Claude Opus 4.8", modality: "text,image_input", contextWindow: 1_000_000, priceTier: "batch", unit: "per_million_tokens", inputPrice: 2.5, outputPrice: 12.5, additionalPrices: { discount: "50%" }, evidenceUrl: "https://platform.claude.com/docs/en/about-claude/pricing", documentVersion: "verified-2026-09-03" },
  { vendor: "google", modelCode: "gemini-3.5-flash", displayName: "Gemini 3.5 Flash", modality: "text,image,audio,video_input", priceTier: "standard", unit: "per_million_tokens", inputPrice: 1.5, cachedInputPrice: 0.15, outputPrice: 9, additionalPrices: { cacheStoragePerMillionTokenHour: 1, googleSearchPer1000AfterFree: 14 }, freeTier: { available: true, input: 0, output: 0, usedToImproveProducts: true }, evidenceUrl: "https://ai.google.dev/gemini-api/docs/pricing", documentVersion: "updated-2026-07-09" },
  { vendor: "google", modelCode: "gemini-3.5-flash", displayName: "Gemini 3.5 Flash", modality: "text,image,audio,video_input", priceTier: "batch", unit: "per_million_tokens", inputPrice: 0.75, cachedInputPrice: 0.075, outputPrice: 4.5, additionalPrices: { cacheStoragePerMillionTokenHour: 1 }, freeTier: { available: false }, evidenceUrl: "https://ai.google.dev/gemini-api/docs/pricing", documentVersion: "updated-2026-07-09" },
  { vendor: "google", modelCode: "gemini-3.5-live-translate-preview", displayName: "Gemini 3.5 Live Translate", modality: "audio", priceTier: "standard", unit: "per_million_audio_tokens", inputPrice: 3.5, outputPrice: 21, additionalPrices: { inputPerMinute: 0.0053, outputPerMinute: 0.0315 }, freeTier: { available: true }, evidenceUrl: "https://ai.google.dev/gemini-api/docs/pricing", documentVersion: "updated-2026-07-09" },
  { vendor: "xai", modelCode: "grok-4.6", displayName: "Grok 4.6", modality: "text,image_input", contextWindow: 500_000, unit: "per_million_tokens", inputPrice: 2, cachedInputPrice: 0.5, outputPrice: 6, freeTier: { available: false }, rateLimits: { requestsPerSecond: 150, tokensPerMinute: 50_000_000 }, evidenceUrl: "https://docs.x.ai/developers/models/grok-4.6", documentVersion: "updated-2026-08-21" },
  { vendor: "xai", modelCode: "grok-imagine-image-2", displayName: "Grok Imagine Image 2.0", modality: "image_generation", unit: "per_image", additionalPrices: { startingAt: 0.02, resolutions: ["1K", "2K"] }, evidenceUrl: "https://docs.x.ai/developers/models", documentVersion: "verified-2026-09-03" },
  { vendor: "xai", modelCode: "grok-voice-api", displayName: "Grok Voice API", modality: "audio", unit: "mixed", additionalPrices: { agentPerMinuteStartingAt: 0.05, ttsPerMillionCharacters: 15, sttBatchPerHour: 0.1, sttStreamingPerHour: 0.2 }, evidenceUrl: "https://docs.x.ai/developers/models", documentVersion: "verified-2026-09-03" },
];

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function decimal(value: number | undefined): string | null {
  return value === undefined ? null : value.toFixed(8);
}

async function upsertVendor(database: Database, seed: VendorSeed): Promise<string> {
  const [row] = await database.insert(officialApiVendors).values(seed).onConflictDoUpdate({
    target: officialApiVendors.slug,
    set: { displayName: seed.displayName, pricingUrl: seed.pricingUrl, modelsUrl: seed.modelsUrl, active: true, updatedAt: new Date() },
  }).returning({ id: officialApiVendors.id });
  if (!row) throw new Error("official_api_vendor_upsert_failed");
  return row.id;
}

async function upsertApiPrice(database: Database, seed: ApiPriceSeed, verifiedAt: Date): Promise<void> {
  const vendorSeed = VENDORS.find((item) => item.slug === seed.vendor);
  if (!vendorSeed) throw new Error(`unknown_api_vendor:${seed.vendor}`);
  const vendorId = await upsertVendor(database, vendorSeed);
  const [model] = await database.insert(officialApiModels).values({
    vendorId,
    modelCode: seed.modelCode,
    displayName: seed.displayName,
    modality: seed.modality,
    contextWindow: seed.contextWindow ?? null,
    availability: seed.availability ?? "public",
  }).onConflictDoUpdate({
    target: [officialApiModels.vendorId, officialApiModels.modelCode],
    set: { displayName: seed.displayName, modality: seed.modality, contextWindow: seed.contextWindow ?? null, availability: seed.availability ?? "public", updatedAt: verifiedAt },
  }).returning({ id: officialApiModels.id });
  if (!model) throw new Error("official_api_model_upsert_failed");
  const priceTier = seed.priceTier ?? "standard";
  const evidenceHash = hash(seed);
  const [existing] = await database.select().from(officialApiPrices).where(and(eq(officialApiPrices.modelId, model.id), eq(officialApiPrices.priceTier, priceTier), eq(officialApiPrices.unit, seed.unit))).limit(1);
  // Historical seeds never replace a live or previously imported record.
  if (existing) return;
  const values = {
    modelId: model.id,
    priceTier,
    unit: seed.unit,
    currency: seed.currency ?? "USD",
    inputPrice: decimal(seed.inputPrice),
    cachedInputPrice: decimal(seed.cachedInputPrice),
    outputPrice: decimal(seed.outputPrice),
    additionalPrices: seed.additionalPrices ?? {},
    freeTier: seed.freeTier ?? {},
    rateLimits: seed.rateLimits ?? {},
    evidenceUrl: seed.evidenceUrl,
    documentVersion: seed.documentVersion ?? null,
    evidenceHash,
    verifiedAt,
  };
  const [price] = await database.insert(officialApiPrices).values(values).onConflictDoNothing({
    target: [officialApiPrices.modelId, officialApiPrices.priceTier, officialApiPrices.unit],
  }).returning({ id: officialApiPrices.id });
  if (price) {
    await database.insert(officialApiPriceHistory).values({
      officialApiPriceId: price.id,
      inputPrice: decimal(seed.inputPrice),
      cachedInputPrice: decimal(seed.cachedInputPrice),
      outputPrice: decimal(seed.outputPrice),
      additionalPrices: seed.additionalPrices ?? {},
      evidenceUrl: seed.evidenceUrl,
      evidenceHash,
      observedAt: verifiedAt,
    });
  }
}

export function seedVerificationDate(documentVersion?: string): Date | null {
  const match = documentVersion?.match(/^verified-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  const date = new Date(`${match[1]}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? date : null;
}

export async function seedVerifiedOfficialApiPrices(database: Database): Promise<{ vendors: number; priceRows: number; skipped: number }> {
  for (const vendor of VENDORS) await upsertVendor(database, vendor);
  let priceRows = 0;
  for (const price of API_PRICES) {
    const verifiedAt = seedVerificationDate(price.documentVersion);
    if (!verifiedAt) continue;
    await upsertApiPrice(database, price, verifiedAt);
    priceRows++;
  }
  return { vendors: VENDORS.length, priceRows, skipped: API_PRICES.length - priceRows };
}
