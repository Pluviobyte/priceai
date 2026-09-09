import { createHash } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { CollectorRegistry } from "@price-radar/collector-sdk";
import {
  crawlRuns,
  merchantFeedSubmissions,
  merchants,
  sources,
  sourceSubmissions,
  type Database,
} from "@price-radar/database";
import { crawlSource, type RawObjectStore } from "./catalog.js";
import { assertSafePublicUrl } from "./url-security.js";

export interface PrecheckSubmissionResult {
  submissionId: string;
  status: "review" | "rejected";
  sourceId: string | null;
  trialRunId: string | null;
  collectorKind: string | null;
  supported: boolean;
}

function merchantSlug(platformKind: string, platformMerchantId: string): string {
  const readable = `${platformKind}-${platformMerchantId}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const suffix = createHash("sha256")
    .update(`${platformKind}:${platformMerchantId}`)
    .digest("hex")
    .slice(0, 12);
  return `${readable || "merchant"}-${suffix}`;
}

async function saveRejectedPrecheck(
  db: Database,
  submissionId: string,
  error: unknown,
): Promise<PrecheckSubmissionResult> {
  const message = error instanceof Error ? error.message : "unknown_precheck_error";
  await db
    .update(sourceSubmissions)
    .set({
      status: "rejected",
      precheckResult: { safe: false, error: message },
      reviewedBy: "automatic_security_precheck",
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(sourceSubmissions.id, submissionId));
  return {
    submissionId,
    status: "rejected",
    sourceId: null,
    trialRunId: null,
    collectorKind: null,
    supported: false,
  };
}

export async function precheckSourceSubmission(
  db: Database,
  registry: CollectorRegistry,
  submissionId: string,
  signal: AbortSignal = new AbortController().signal,
  rawObjectStore?: RawObjectStore,
): Promise<PrecheckSubmissionResult> {
  const [submission] = await db
    .select()
    .from(sourceSubmissions)
    .where(eq(sourceSubmissions.id, submissionId))
    .limit(1);
  if (!submission) throw new Error("source_submission_not_found");
  if (submission.status === "approved") throw new Error("source_submission_already_approved");

  let sourceUrl: URL;
  try {
    sourceUrl = await assertSafePublicUrl(submission.url);
  } catch (error) {
    return saveRejectedPrecheck(db, submissionId, error);
  }

  await db
    .update(sourceSubmissions)
    .set({ status: "prechecked", precheckResult: { safe: true }, updatedAt: new Date() })
    .where(eq(sourceSubmissions.id, submissionId));

  const probeResults = await registry.probe(sourceUrl, signal);
  const selected = probeResults.find((result) => result.supported && result.identity);
  if (!selected?.identity) {
    await db
      .update(sourceSubmissions)
      .set({
        status: "review",
        precheckResult: { safe: true, supported: false, probes: probeResults },
        updatedAt: new Date(),
      })
      .where(eq(sourceSubmissions.id, submissionId));
    return {
      submissionId,
      status: "review",
      sourceId: null,
      trialRunId: null,
      collectorKind: null,
      supported: false,
    };
  }

  const identity = selected.identity;
  await assertSafePublicUrl(identity.canonicalEntryUrl);
  const name = submission.name?.trim() || identity.merchantName || identity.platformMerchantId;
  const slug = merchantSlug(identity.platformKind, identity.platformMerchantId);
  const source = await db.transaction(async (tx) => {
    const [merchant] = await tx
      .insert(merchants)
      .values({ name, slug, websiteUrl: identity.canonicalEntryUrl, commercialRelation: selected.collectorKind === "merchant_feed" ? "merchant_direct" : "none" })
      .onConflictDoUpdate({
        target: merchants.slug,
        set: { name, websiteUrl: identity.canonicalEntryUrl, ...(selected.collectorKind === "merchant_feed" ? { commercialRelation: "merchant_direct" as const } : {}), updatedAt: new Date() },
      })
      .returning({ id: merchants.id });
    if (!merchant) throw new Error("merchant_upsert_failed");
    const [storedSource] = await tx
      .insert(sources)
      .values({
        merchantId: merchant.id,
        platformKind: identity.platformKind,
        platformMerchantId: identity.platformMerchantId,
        ...(identity.shopToken ? { shopToken: identity.shopToken } : {}),
        canonicalEntryUrl: identity.canonicalEntryUrl,
        submittedUrl: sourceUrl.toString(),
        collectorKind: selected.collectorKind,
        enabled: false,
        healthStatus: "paused",
      })
      .onConflictDoUpdate({
        target: [sources.platformKind, sources.platformMerchantId],
        set: {
          merchantId: merchant.id,
          ...(identity.shopToken ? { shopToken: identity.shopToken } : {}),
          canonicalEntryUrl: identity.canonicalEntryUrl,
          submittedUrl: sourceUrl.toString(),
          collectorKind: selected.collectorKind,
          updatedAt: new Date(),
        },
      })
      .returning({ id: sources.id });
    if (!storedSource) throw new Error("source_upsert_failed");
    await tx
      .update(sourceSubmissions)
      .set({
        sourceId: storedSource.id,
        detectedCollectorKind: selected.collectorKind,
        precheckResult: {
          safe: true,
          supported: true,
          collectorKind: selected.collectorKind,
          confidence: selected.confidence,
          identity,
        },
        updatedAt: new Date(),
      })
      .where(eq(sourceSubmissions.id, submissionId));
    if (selected.collectorKind === "merchant_feed") {
      await tx.update(merchantFeedSubmissions).set({ sourceId: storedSource.id, status: "trial", updatedAt: new Date() }).where(eq(merchantFeedSubmissions.feedUrl, sourceUrl.toString()));
    }
    return storedSource;
  });

  try {
    const trial = await crawlSource(db, registry, source.id, {
      allowDisabled: true,
      promoteSource: false,
      signal,
      maxPages: selected.collectorKind === "shop_api" ? 12 : 50,
      ...(rawObjectStore ? { rawObjectStore } : {}),
    });
    await db
      .update(sourceSubmissions)
      .set({
        status: "review",
        trialRunId: trial.runId,
        precheckResult: {
          safe: true,
          supported: true,
          collectorKind: selected.collectorKind,
          confidence: selected.confidence,
          identity,
          trial,
        },
        updatedAt: new Date(),
      })
      .where(eq(sourceSubmissions.id, submissionId));
    return {
      submissionId,
      status: "review",
      sourceId: source.id,
      trialRunId: trial.runId,
      collectorKind: selected.collectorKind,
      supported: true,
    };
  } catch (error) {
    const [failedRun] = await db
      .select({ id: crawlRuns.id })
      .from(crawlRuns)
      .where(eq(crawlRuns.sourceId, source.id))
      .orderBy(desc(crawlRuns.createdAt))
      .limit(1);
    const message = error instanceof Error ? error.message : "trial_crawl_failed";
    await db
      .update(sourceSubmissions)
      .set({
        status: "review",
        ...(failedRun ? { trialRunId: failedRun.id } : {}),
        precheckResult: {
          safe: true,
          supported: true,
          collectorKind: selected.collectorKind,
          confidence: selected.confidence,
          identity,
          trialError: message,
        },
        updatedAt: new Date(),
      })
      .where(eq(sourceSubmissions.id, submissionId));
    return {
      submissionId,
      status: "review",
      sourceId: source.id,
      trialRunId: failedRun?.id ?? null,
      collectorKind: selected.collectorKind,
      supported: true,
    };
  }
}
