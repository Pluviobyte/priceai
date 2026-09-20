import { discoveryFailure } from "./discovery-policy.js";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { discoveryRuns, sourceCandidates, sources, type Database } from "@price-radar/database";
import { resolveCandidateIdentity, type CandidateIdentity } from "@price-radar/source-signatures";

/**
 * Candidate leads are shop URLs found anywhere (directories, platform
 * marketplaces, X, search, feeds). They are never price facts. Every lead is
 * reduced to a network-free identity so the same shop reached through several
 * mirror domains or several directories becomes one candidate with the list of
 * places that mentioned it.
 */
export type LeadDiscoveryKind = "submission" | "manual" | "grok_x" | "search" | "community" | "aggregator" | "directory" | "platform" | "crawl";

export interface CandidateLead {
  url: string;
  provider: string;
  discoveryKind: LeadDiscoveryKind;
  discoveryUrl?: string;
  nameHint?: string;
  seenAt?: Date;
}

export interface IngestSummary {
  considered: number;
  inserted: number;
  merged: number;
  skippedKnownSource: number;
  skippedInvalid: number;
}

export interface DiscoveryEvidence {
  provider: string;
  url: string | null;
  seenAt: string;
  nameHint?: string;
}

/** Statuses that finish a candidate's life unless a retry time re-opens it. */
export const FINAL_CANDIDATE_STATUSES = ["approved", "duplicate", "rejected", "adapter_needed"] as const;

const HOST_IDENTITY_KINDS = ["dujiao", "kami", "generic_html", "custom_html", "public_json", "browser", "merchant_feed", "web"];

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|\d{1,3}(?:\.\d{1,3}){3}|\[?[0-9a-f:]+\]?)$/i;

/** Cheap syntactic filter; the real SSRF check runs when the candidate is vetted. */
export function isPlausiblePublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username || url.password) return false;
    if (url.port && url.port !== "80" && url.port !== "443") return false;
    if (!url.hostname.includes(".") || PRIVATE_HOST.test(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function normalizeLeadUrl(value: string): string | null {
  if (!isPlausiblePublicUrl(value)) return null;
  const url = new URL(value.trim());
  url.hash = "";
  url.search = "";
  url.hostname = url.hostname.toLowerCase();
  return url.toString();
}

export function leadIdentity(lead: CandidateLead): CandidateIdentity | null {
  const normalized = normalizeLeadUrl(lead.url);
  if (!normalized) return null;
  return resolveCandidateIdentity(normalized);
}

async function knownSourceExists(db: Database, identity: CandidateIdentity): Promise<boolean> {
  if (!identity.platformMerchantId) return false;
  const conditions = [and(eq(sources.platformKind, identity.platformKind), eq(sources.platformMerchantId, identity.platformMerchantId))];
  if (identity.kind === "host") {
    conditions.push(and(inArray(sources.platformKind, HOST_IDENTITY_KINDS), eq(sources.platformMerchantId, identity.platformMerchantId)));
  }
  const [row] = await db.select({ id: sources.id }).from(sources).where(or(...conditions)).limit(1);
  return Boolean(row);
}

function mergeEvidence(existing: DiscoveryEvidence[] | null | undefined, lead: CandidateLead, seenAt: string): DiscoveryEvidence[] {
  const list = [...(existing ?? [])];
  const index = list.findIndex((item) => item.provider === lead.provider);
  const entry: DiscoveryEvidence = { provider: lead.provider, url: lead.discoveryUrl ?? null, seenAt, ...(lead.nameHint ? { nameHint: lead.nameHint } : {}) };
  if (index >= 0) list[index] = entry;
  else list.push(entry);
  return list.slice(0, 50);
}

export async function ingestCandidateLeads(db: Database, leads: readonly CandidateLead[], runId?: string, signal?: AbortSignal): Promise<IngestSummary> {
  const summary: IngestSummary = { considered: 0, inserted: 0, merged: 0, skippedKnownSource: 0, skippedInvalid: 0 };
  const seenInBatch = new Set<string>();
  for (const lead of leads) {
    signal?.throwIfAborted();
    summary.considered += 1;
    const identity = leadIdentity(lead);
    if (!identity) {
      summary.skippedInvalid += 1;
      continue;
    }
    const batchKey = identity.platformMerchantId ? `${identity.platformKind}:${identity.platformMerchantId}` : `url:${identity.canonicalUrl}`;
    if (seenInBatch.has(batchKey)) {
      summary.merged += 1;
      continue;
    }
    seenInBatch.add(batchKey);
    if (await knownSourceExists(db, identity)) {
      summary.skippedKnownSource += 1;
      continue;
    }
    const seenAt = (lead.seenAt ?? new Date()).toISOString();
    const existing = identity.platformMerchantId
      ? await db.select({ id: sourceCandidates.id, status: sourceCandidates.status, evidence: sourceCandidates.discoveryEvidence, nextVetAt: sourceCandidates.nextVetAt, nameHint: sourceCandidates.merchantNameHint })
          .from(sourceCandidates)
          .where(and(eq(sourceCandidates.platformKind, identity.platformKind), eq(sourceCandidates.platformMerchantId, identity.platformMerchantId)))
          .limit(1)
      : await db.select({ id: sourceCandidates.id, status: sourceCandidates.status, evidence: sourceCandidates.discoveryEvidence, nextVetAt: sourceCandidates.nextVetAt, nameHint: sourceCandidates.merchantNameHint })
          .from(sourceCandidates)
          .where(and(eq(sourceCandidates.candidateUrl, identity.canonicalUrl), isNull(sourceCandidates.platformMerchantId)))
          .limit(1);
    const current = existing[0];
    if (current) {
      const evidence = mergeEvidence(current.evidence, lead, seenAt);
      const reopen = current.status === "rejected" && current.nextVetAt !== null && current.nextVetAt.getTime() <= Date.now();
      await db.update(sourceCandidates).set({
        discoveryEvidence: evidence,
        priority: new Set(evidence.map((item) => item.provider)).size,
        ...(current.nameHint ? {} : lead.nameHint ? { merchantNameHint: lead.nameHint.slice(0, 200) } : {}),
        ...(reopen ? { status: "pending", nextVetAt: null, reviewNote: `retry_after_rejection:${runId ?? "manual"}` } : {}),
      }).where(eq(sourceCandidates.id, current.id));
      summary.merged += 1;
      continue;
    }
    await db.insert(sourceCandidates).values({
      candidateUrl: identity.canonicalUrl,
      ...(lead.nameHint ? { merchantNameHint: lead.nameHint.slice(0, 200) } : {}),
      platformHint: identity.platformHint,
      discoveryKind: lead.discoveryKind,
      discoveryUrl: lead.discoveryUrl ?? identity.canonicalUrl,
      status: "pending",
      reviewNote: runId ? `discovery_run:${runId}` : null,
      platformKind: identity.platformKind,
      ...(identity.platformMerchantId ? { platformMerchantId: identity.platformMerchantId } : {}),
      priority: 1,
      discoveryEvidence: mergeEvidence([], lead, seenAt),
    }).onConflictDoNothing();
    summary.inserted += 1;
  }
  return summary;
}

export interface DiscoveryRunInput {
  ownership?: string;
  consecutiveFailures?: number;
  kind: LeadDiscoveryKind;
  query: string;
  provider: string;
}

/** Records one discovery attempt and ingests the leads it produced. */
export async function recordDiscoveryRun(
  db: Database,
  input: DiscoveryRunInput,
  work: () => Promise<CandidateLead[]>,
  signal?: AbortSignal,
): Promise<{ runId: string; resultCount: number; candidateCount: number; summary: IngestSummary }> {
  const [run] = await db.insert(discoveryRuns).values({ kind: input.kind, query: input.query, provider: input.provider, evidence: input.ownership ? { ownership: input.ownership } : {} }).returning({ id: discoveryRuns.id });
  if (!run) throw new Error("discovery_run_insert_failed");
  try {
    const leads = await work();
    const summary = await ingestCandidateLeads(db, leads.slice(0, 5_000), run.id, signal);
    signal?.throwIfAborted();
    const digest = createHash("sha256").update(JSON.stringify(leads.map((lead) => lead.url))).digest("hex");
    await db.update(discoveryRuns).set({
      status: "success",
      resultCount: leads.length,
      candidateCount: summary.inserted,
      evidence: { ...(input.ownership ? { ownership: input.ownership } : {}), resultDigest: digest, ...summary },
      finishedAt: new Date(),
    }).where(eq(discoveryRuns.id, run.id));
    return { runId: run.id, resultCount: leads.length, candidateCount: summary.inserted, summary };
  } catch (error) {
    await db.update(discoveryRuns).set({
      status: "failed",
      evidence: { ...(input.ownership ? { ownership: input.ownership } : {}), ...discoveryFailure(error, new Date(), input.consecutiveFailures ?? 1) },
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "discovery_failed",
      finishedAt: new Date(),
    }).where(eq(discoveryRuns.id, run.id));
    throw error;
  }
}

/** Last successful run per provider, used to decide whether a daily import is due. */
export async function lastSuccessfulDiscoveryAt(db: Database, provider: string): Promise<Date | null> {
  // Aggregates come back untyped from the driver (string timestamps), so normalise explicitly.
  const [row] = await db.select({ finishedAt: sql<Date | string | null>`max(${discoveryRuns.finishedAt})` })
    .from(discoveryRuns)
    .where(and(eq(discoveryRuns.provider, provider), eq(discoveryRuns.status, "success")));
  const value = row?.finishedAt;
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
