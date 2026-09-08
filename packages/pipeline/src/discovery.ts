import type { Database } from "@price-radar/database";
import { recordDiscoveryRun, type CandidateLead } from "./candidates.js";
import { assertSafePublicUrl } from "./url-security.js";

export interface DiscoveredSource {
  url: string;
  title?: string;
  evidenceUrl?: string;
}

function urlList(value: string): string[] {
  const matches = value.match(/https?:\/\/[^\s\]})>,"']+/g) ?? [];
  return [...new Set(matches.map((item) => item.replace(/[.;:!?]+$/, "")))].slice(0, 200);
}

function toLeads(results: DiscoveredSource[], provider: string, discoveryKind: CandidateLead["discoveryKind"]): CandidateLead[] {
  return results.map((result) => ({
    url: result.url,
    provider,
    discoveryKind,
    ...(result.evidenceUrl ? { discoveryUrl: result.evidenceUrl } : {}),
    ...(result.title ? { nameHint: result.title } : {}),
  }));
}

export async function discoverSourcesWithGrok(database: Database, input: { apiKey: string; query: string }) {
  const provider = "xai_grok_x_search";
  return recordDiscoveryRun(database, { kind: "grok_x", query: input.query, provider }, async () => {
    const prompt = `Search X and the public web for public AI subscription card shops, pricing comparison sites, and merchant feed URLs related to: ${input.query}. Return source URLs with short titles. Treat results only as discovery leads, never as price facts.`;
    const response = await fetch("https://api.x.ai/v1/responses", { method: "POST", redirect: "error", signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: "grok-4.6", input: [{ role: "user", content: prompt }], tools: [{ type: "x_search" }, { type: "web_search" }], tool_choice: "required", max_turns: 5, store: false }) });
    if (!response.ok) throw new Error(`grok_discovery_http_${response.status}`);
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n") ?? "";
    return toLeads(urlList(text).map((url) => ({ url, evidenceUrl: url })), provider, "grok_x");
  });
}

export async function discoverSourcesWithBrave(database: Database, input: { apiKey: string; query: string }) {
  const provider = "brave_search_api";
  return recordDiscoveryRun(database, { kind: "search", query: input.query, provider }, async () => {
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", input.query);
    endpoint.searchParams.set("count", "20");
    const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { accept: "application/json", "x-subscription-token": input.apiKey } });
    if (!response.ok) throw new Error(`search_discovery_http_${response.status}`);
    const payload = await response.json() as { web?: { results?: Array<{ url?: string; title?: string }> } };
    const results = (payload.web?.results ?? []).flatMap((item) => item.url ? [{ url: item.url, ...(item.title ? { title: item.title } : {}), evidenceUrl: item.url }] : []);
    return toLeads(results, provider, "search");
  });
}

export async function checkAggregatorCoverage(database: Database, feedUrl: string) {
  const provider = "public_aggregator_feed";
  return recordDiscoveryRun(database, { kind: "aggregator", query: feedUrl, provider }, async () => {
    const safe = await assertSafePublicUrl(feedUrl);
    const response = await fetch(safe, { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { accept: "application/json,text/plain,text/html", "user-agent": "AIPriceRadar/0.1 (+coverage-gap-check)" } });
    if (!response.ok) throw new Error(`aggregator_feed_http_${response.status}`);
    const text = await response.text();
    if (text.length > 10_000_000) throw new Error("aggregator_feed_too_large");
    return toLeads(urlList(text).map((url) => ({ url, evidenceUrl: safe.toString() })), provider, "aggregator");
  });
}
