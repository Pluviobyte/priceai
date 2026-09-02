import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { discoveryRuns, sourceCandidates, sources, type Database } from "@price-radar/database";
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

async function ingest(database: Database, runId: string, input: { kind: "grok_x" | "search" | "aggregator"; results: DiscoveredSource[] }): Promise<number> {
  let inserted = 0;
  for (const result of input.results.slice(0, 200)) {
    let url: URL;
    try { url = await assertSafePublicUrl(result.url); } catch { continue; }
    const [known] = await database.select({ id: sources.id }).from(sources).where(eq(sources.canonicalEntryUrl, url.toString())).limit(1);
    if (known) continue;
    const [candidate] = await database.select({ id: sourceCandidates.id }).from(sourceCandidates).where(and(eq(sourceCandidates.candidateUrl, url.toString()), eq(sourceCandidates.status, "pending"))).limit(1);
    if (candidate) continue;
    await database.insert(sourceCandidates).values({ candidateUrl: url.toString(), merchantNameHint: result.title?.slice(0, 200), discoveryKind: input.kind, discoveryUrl: result.evidenceUrl ?? url.toString(), status: "pending", reviewNote: `discovery_run:${runId}` });
    inserted += 1;
  }
  return inserted;
}

async function withRun(database: Database, input: { kind: "grok_x" | "search" | "aggregator"; query: string; provider: string }, work: () => Promise<DiscoveredSource[]>) {
  const [run] = await database.insert(discoveryRuns).values({ kind: input.kind, query: input.query, provider: input.provider }).returning({ id: discoveryRuns.id });
  if (!run) throw new Error("discovery_run_insert_failed");
  try {
    const results = await work();
    const candidateCount = await ingest(database, run.id, { kind: input.kind, results });
    await database.update(discoveryRuns).set({ status: "success", resultCount: results.length, candidateCount, evidence: { resultDigest: createHash("sha256").update(JSON.stringify(results.map((item) => item.url))).digest("hex") }, finishedAt: new Date() }).where(eq(discoveryRuns.id, run.id));
    return { runId: run.id, resultCount: results.length, candidateCount };
  } catch (error) {
    await database.update(discoveryRuns).set({ status: "failed", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "discovery_failed", finishedAt: new Date() }).where(eq(discoveryRuns.id, run.id));
    throw error;
  }
}

export async function discoverSourcesWithGrok(database: Database, input: { apiKey: string; query: string }) {
  return withRun(database, { kind: "grok_x", query: input.query, provider: "xai_grok_x_search" }, async () => {
    const prompt = `Search X and the public web for public AI subscription card shops, pricing comparison sites, and merchant feed URLs related to: ${input.query}. Return source URLs with short titles. Treat results only as discovery leads, never as price facts.`;
    const response = await fetch("https://api.x.ai/v1/responses", { method: "POST", redirect: "error", signal: AbortSignal.timeout(60_000), headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: "grok-4.6", input: [{ role: "user", content: prompt }], tools: [{ type: "x_search" }, { type: "web_search" }], tool_choice: "required", max_turns: 5, store: false }) });
    if (!response.ok) throw new Error(`grok_discovery_http_${response.status}`);
    const payload = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
    const text = payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n") ?? "";
    return urlList(text).map((url) => ({ url, evidenceUrl: url }));
  });
}

export async function discoverSourcesWithBrave(database: Database, input: { apiKey: string; query: string }) {
  return withRun(database, { kind: "search", query: input.query, provider: "brave_search_api" }, async () => {
    const endpoint = new URL("https://api.search.brave.com/res/v1/web/search");
    endpoint.searchParams.set("q", input.query);
    endpoint.searchParams.set("count", "20");
    const response = await fetch(endpoint, { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { accept: "application/json", "x-subscription-token": input.apiKey } });
    if (!response.ok) throw new Error(`search_discovery_http_${response.status}`);
    const payload = await response.json() as { web?: { results?: Array<{ url?: string; title?: string }> } };
    return (payload.web?.results ?? []).flatMap((item) => item.url ? [{ url: item.url, ...(item.title ? { title: item.title } : {}), evidenceUrl: item.url }] : []);
  });
}

export async function checkAggregatorCoverage(database: Database, feedUrl: string) {
  return withRun(database, { kind: "aggregator", query: feedUrl, provider: "public_aggregator_feed" }, async () => {
    const safe = await assertSafePublicUrl(feedUrl);
    const response = await fetch(safe, { redirect: "error", signal: AbortSignal.timeout(30_000), headers: { accept: "application/json,text/plain,text/html", "user-agent": "AIPriceRadar/0.1 (+coverage-gap-check)" } });
    if (!response.ok) throw new Error(`aggregator_feed_http_${response.status}`);
    const text = await response.text();
    if (text.length > 10_000_000) throw new Error("aggregator_feed_too_large");
    return urlList(text).map((url) => ({ url, evidenceUrl: safe.toString() }));
  });
}
