import {
  transitEvents,
  transitModelPrices,
  transitProbes,
  transitProviders,
  type Database,
} from "@price-radar/database";
import { desc, eq } from "drizzle-orm";

interface ProviderSeed {
  slug: string;
  displayName: string;
  websiteUrl: string;
  apiBaseUrl: string;
  modelsEndpoint: string;
  statusUrl: string;
  operatorName: string;
  systemKind: string;
  discoverySource: string;
  evidenceUrl: string;
  active: boolean;
}

export interface OneTimeModelCheck {
  endpoint: string;
  modelCount: number;
  models: string[];
  latencyMs: number;
  test?: { model: string; success: boolean; latencyMs: number; status: number };
}

const PROVIDERS: readonly ProviderSeed[] = [
  {
    slug: "openrouter",
    displayName: "OpenRouter",
    websiteUrl: "https://openrouter.ai/",
    apiBaseUrl: "https://openrouter.ai/api/v1",
    modelsEndpoint: "https://openrouter.ai/api/v1/models",
    statusUrl: "https://status.openrouter.ai/",
    operatorName: "OpenRouter, Inc.",
    systemKind: "openai_compatible_gateway",
    discoverySource: "operator_official_documentation",
    evidenceUrl: "https://openrouter.ai/docs/api-reference/list-available-models",
    active: true,
  },
  {
    slug: "vercel-ai-gateway",
    displayName: "Vercel AI Gateway",
    websiteUrl: "https://vercel.com/ai-gateway",
    apiBaseUrl: "https://ai-gateway.vercel.sh/v1",
    modelsEndpoint: "https://ai-gateway.vercel.sh/v1/models",
    statusUrl: "https://www.vercel-status.com/",
    operatorName: "Vercel Inc.",
    systemKind: "openai_compatible_gateway",
    discoverySource: "operator_official_documentation",
    evidenceUrl: "https://vercel.com/docs/ai-gateway/models-and-providers",
    active: true,
  },
] as const;

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function modelArray(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  return Array.isArray(data) ? data.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

async function boundedJson(url: string, init: RequestInit = {}): Promise<{ payload: unknown; status: number; latencyMs: number }> {
  const started = performance.now();
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
    headers: {
      accept: "application/json",
      "user-agent": "AIPriceRadar/0.1 (+public-gateway-monitor)",
      ...(init.headers ?? {}),
    },
  });
  const latencyMs = Math.round(performance.now() - started);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("transit_response_too_large");
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error("transit_response_too_large");
  let payload: unknown = null;
  try { payload = JSON.parse(text); } catch { payload = { raw: text.slice(0, 500) }; }
  if (!response.ok) throw Object.assign(new Error(`transit_http_${response.status}`), { httpStatus: response.status, latencyMs });
  return { payload, status: response.status, latencyMs };
}

async function upsertProvider(database: Database, seed: ProviderSeed): Promise<string> {
  const [row] = await database.insert(transitProviders).values(seed).onConflictDoUpdate({
    target: transitProviders.slug,
    set: { ...seed, updatedAt: new Date() },
  }).returning({ id: transitProviders.id });
  if (!row) throw new Error("transit_provider_upsert_failed");
  return row.id;
}

async function recordTransition(database: Database, providerId: string, success: boolean, checkedAt: Date): Promise<void> {
  const [previous] = await database.select({ success: transitProbes.success }).from(transitProbes).where(eq(transitProbes.providerId, providerId)).orderBy(desc(transitProbes.checkedAt)).limit(1);
  if (!previous || previous.success === success) return;
  if (success) {
    const [outage] = await database.select({ id: transitEvents.id }).from(transitEvents).where(eq(transitEvents.providerId, providerId)).orderBy(desc(transitEvents.startedAt)).limit(1);
    if (outage) await database.update(transitEvents).set({ endedAt: checkedAt }).where(eq(transitEvents.id, outage.id));
    await database.insert(transitEvents).values({ providerId, kind: "recovery", title: "Public model endpoint recovered", details: "The platform monitor observed a successful response after a failed check.", startedAt: checkedAt, endedAt: checkedAt });
  } else {
    await database.insert(transitEvents).values({ providerId, kind: "outage", title: "Public model endpoint unavailable", details: "The platform monitor observed a failed public endpoint check. This does not test paid inference.", startedAt: checkedAt });
  }
}

export async function seedTransitProviders(database: Database): Promise<number> {
  for (const provider of PROVIDERS) await upsertProvider(database, provider);
  return PROVIDERS.length;
}

export async function refreshTransitProvider(database: Database, slug: string): Promise<{ success: boolean; models: number; prices: number }> {
  const seed = PROVIDERS.find((provider) => provider.slug === slug);
  if (!seed) throw new Error(`unknown_transit_provider:${slug}`);
  const providerId = await upsertProvider(database, seed);
  const checkedAt = new Date();
  try {
    const result = await boundedJson(seed.modelsEndpoint);
    const models = modelArray(result.payload);
    await recordTransition(database, providerId, true, checkedAt);
    await database.insert(transitProbes).values({ providerId, probeKind: "public_model_catalog", success: true, latencyMs: result.latencyMs, httpStatus: result.status, modelCount: models.length, evidence: { endpoint: seed.modelsEndpoint } });
    let prices = 0;
    for (const model of models) {
      const modelCode = typeof model.id === "string" ? model.id : null;
      if (!modelCode) continue;
      const pricing = model.pricing && typeof model.pricing === "object" ? model.pricing as Record<string, unknown> : {};
      const inputPerToken = numberOrNull(pricing.prompt ?? pricing.input);
      const outputPerToken = numberOrNull(pricing.completion ?? pricing.output);
      if (inputPerToken === null && outputPerToken === null) continue;
      await database.insert(transitModelPrices).values({
        providerId,
        modelCode,
        displayName: typeof model.name === "string" ? model.name : modelCode,
        inputPrice: inputPerToken === null ? null : (inputPerToken * 1_000_000).toFixed(8),
        outputPrice: outputPerToken === null ? null : (outputPerToken * 1_000_000).toFixed(8),
        evidenceKind: "provider_self_reported",
        evidenceUrl: seed.modelsEndpoint,
        verifiedAt: checkedAt,
      }).onConflictDoUpdate({
        target: [transitModelPrices.providerId, transitModelPrices.modelCode],
        set: {
          displayName: typeof model.name === "string" ? model.name : modelCode,
          inputPrice: inputPerToken === null ? null : (inputPerToken * 1_000_000).toFixed(8),
          outputPrice: outputPerToken === null ? null : (outputPerToken * 1_000_000).toFixed(8),
          evidenceKind: "provider_self_reported",
          evidenceUrl: seed.modelsEndpoint,
          verifiedAt: checkedAt,
          updatedAt: checkedAt,
        },
      });
      prices += 1;
    }
    return { success: true, models: models.length, prices };
  } catch (error) {
    const details = error as Error & { httpStatus?: number; latencyMs?: number };
    await recordTransition(database, providerId, false, checkedAt);
    await database.insert(transitProbes).values({
      providerId,
      probeKind: "public_model_catalog",
      success: false,
      latencyMs: details.latencyMs ?? null,
      httpStatus: details.httpStatus ?? null,
      errorCode: details.message.slice(0, 160),
      evidence: { endpoint: seed.modelsEndpoint },
    });
    return { success: false, models: 0, prices: 0 };
  }
}

export async function refreshAllTransitProviders(database: Database): Promise<Record<string, { success: boolean; models: number; prices: number }>> {
  const results: Record<string, { success: boolean; models: number; prices: number }> = {};
  for (const provider of PROVIDERS.filter((item) => item.active)) results[provider.slug] = await refreshTransitProvider(database, provider.slug);
  return results;
}

export async function runOneTimeModelCheck(input: { endpoint: URL; apiKey: string; model?: string }): Promise<OneTimeModelCheck> {
  const base = input.endpoint.toString().replace(/\/$/, "");
  const modelsUrl = base.endsWith("/models") ? base : `${base}/models`;
  const headers = { authorization: `Bearer ${input.apiKey}` };
  const catalog = await boundedJson(modelsUrl, { headers });
  const models = modelArray(catalog.payload).map((item) => typeof item.id === "string" ? item.id : "").filter(Boolean);
  const result: OneTimeModelCheck = { endpoint: input.endpoint.origin, modelCount: models.length, models: models.slice(0, 100), latencyMs: catalog.latencyMs };
  if (input.model) {
    const completionUrl = `${base.replace(/\/models$/, "")}/chat/completions`;
    const started = performance.now();
    const response = await fetch(completionUrl, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20_000),
      headers: { ...headers, "content-type": "application/json", "user-agent": "AIPriceRadar/0.1 (+one-time-user-key-check)" },
      body: JSON.stringify({ model: input.model, messages: [{ role: "user", content: "Reply OK" }], max_tokens: 1, stream: false }),
    });
    await response.body?.cancel();
    result.test = { model: input.model, success: response.ok, latencyMs: Math.round(performance.now() - started), status: response.status };
  }
  return result;
}
