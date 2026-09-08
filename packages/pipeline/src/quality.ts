import { and, eq, sql } from "drizzle-orm";
import { llmExtractionCandidates, rawOfferSnapshots, semanticDuplicateCandidates, type Database } from "@price-radar/database";

export function tokens(value: string): Set<string> {
  const normalized = value.normalize("NFKC").toLowerCase().replace(/https?:\/\/\S+/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  const result = new Set(words);
  for (const word of words) if (word.length >= 4) for (let index = 0; index < word.length - 1; index += 1) result.add(word.slice(index, index + 2));
  return result;
}

export function jaccard(left: Set<string>, right: Set<string>): number {
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export async function detectSemanticDuplicatesForRun(database: Database, sourceId: string, runId: string): Promise<number> {
  const rows = await database.select({ id: rawOfferSnapshots.id, title: rawOfferSnapshots.rawTitle, price: rawOfferSnapshots.rawPriceNumeric, productUrl: rawOfferSnapshots.productUrl }).from(rawOfferSnapshots).where(and(eq(rawOfferSnapshots.sourceId, sourceId), eq(rawOfferSnapshots.crawlRunId, runId))).limit(500);
  let candidates = 0;
  for (let leftIndex = 0; leftIndex < rows.length; leftIndex += 1) {
    const left = rows[leftIndex]; if (!left) continue;
    const leftTokens = tokens(left.title);
    for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex += 1) {
      const right = rows[rightIndex]; if (!right) continue;
      const titleScore = jaccard(leftTokens, tokens(right.title));
      const leftPrice = Number(left.price); const rightPrice = Number(right.price);
      const priceScore = Number.isFinite(leftPrice) && Number.isFinite(rightPrice) && Math.max(leftPrice, rightPrice) > 0 ? 1 - Math.min(1, Math.abs(leftPrice - rightPrice) / Math.max(leftPrice, rightPrice)) : 0;
      const urlScore = new URL(left.productUrl).pathname.replace(/\d+/g, "#") === new URL(right.productUrl).pathname.replace(/\d+/g, "#") ? 1 : 0;
      const score = titleScore * 0.75 + priceScore * 0.15 + urlScore * 0.1;
      if (score < 0.82) continue;
      await database.insert(semanticDuplicateCandidates).values({ sourceId, leftSnapshotId: left.id, rightSnapshotId: right.id, score: score.toFixed(4), signals: [`title_jaccard:${titleScore.toFixed(3)}`, `price_similarity:${priceScore.toFixed(3)}`, `url_template:${urlScore}`] }).onConflictDoUpdate({ target: [semanticDuplicateCandidates.leftSnapshotId, semanticDuplicateCandidates.rightSnapshotId], set: { score: score.toFixed(4), signals: [`title_jaccard:${titleScore.toFixed(3)}`, `price_similarity:${priceScore.toFixed(3)}`, `url_template:${urlScore}`], status: sql`case when ${semanticDuplicateCandidates.status}='ignored' then 'ignored' else 'candidate' end` } });
      candidates += 1;
    }
  }
  return candidates;
}

export async function generateLlmExtractionCandidates(database: Database, input: { endpoint: string; apiKey: string; model: string; limit?: number }): Promise<{ attempted: number; saved: number }> {
  const endpoint = new URL(input.endpoint);
  if (endpoint.protocol !== "https:") throw new Error("llm_endpoint_https_required");
  const rows = await database.execute(sql`
    select ros.id,ros.raw_title,ros.raw_description,ros.raw_category,ros.raw_price_text
      from raw_offer_snapshots ros
      join offer_matches om on om.raw_offer_snapshot_id=ros.id
     where om.review_status='pending'
       and not exists(select 1 from llm_extraction_candidates c where c.raw_offer_snapshot_id=ros.id and c.model=${input.model} and c.prompt_version='v1')
     order by ros.captured_at desc limit ${Math.min(100, Math.max(1, input.limit ?? 20))}
  `);
  let saved = 0;
  for (const row of rows.rows as Array<{ id: string; raw_title: string; raw_description: string | null; raw_category: string | null; raw_price_text: string }>) {
    const response = await fetch(endpoint, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000), headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" }, body: JSON.stringify({ model: input.model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: "Extract candidate attributes only. Never decide publication or ranking. Return JSON with canonicalProduct, offerMode, durationDays, warrantyType, accountOwnership, phoneBound, shared, webAvailable, apiAvailable, confidence, evidence." }, { role: "user", content: JSON.stringify(row) }] }) });
    if (!response.ok) continue;
    const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) continue;
    let candidate: Record<string, unknown>;
    try { const parsed = JSON.parse(content) as unknown; if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue; candidate = parsed as Record<string, unknown>; } catch { continue; }
    const confidence = typeof candidate.confidence === "number" && candidate.confidence >= 0 && candidate.confidence <= 1 ? candidate.confidence.toFixed(4) : null;
    await database.insert(llmExtractionCandidates).values({ rawOfferSnapshotId: row.id, provider: endpoint.hostname, model: input.model, promptVersion: "v1", candidate, confidence }).onConflictDoNothing({ target: [llmExtractionCandidates.rawOfferSnapshotId, llmExtractionCandidates.model, llmExtractionCandidates.promptVersion] });
    saved += 1;
  }
  return { attempted: rows.rows.length, saved };
}
