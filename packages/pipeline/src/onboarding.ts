import { eq } from "drizzle-orm";
import type { CollectorRegistry } from "@price-radar/collector-sdk";
import {
  merchants,
  sources,
  sourceSubmissions,
  type Database,
} from "@price-radar/database";
import { assertSafePublicUrl } from "./url-security.js";

export interface OnboardSourceResult {
  sourceId: string;
  submissionId: string;
  collectorKind: string;
  canonicalEntryUrl: string;
  merchantName: string;
}

function merchantSlug(platformKind: string, platformMerchantId: string): string {
  return `${platformKind}-${platformMerchantId}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

export async function onboardSource(
  db: Database,
  registry: CollectorRegistry,
  inputUrl: string,
  signal: AbortSignal = new AbortController().signal,
): Promise<OnboardSourceResult> {
  const sourceUrl = await assertSafePublicUrl(inputUrl);
  const [submission] = await db
    .insert(sourceSubmissions)
    .values({ url: sourceUrl.toString(), status: "submitted" })
    .returning({ id: sourceSubmissions.id });
  if (!submission) throw new Error("source_submission_insert_failed");

  const probeResults = await registry.probe(sourceUrl, signal);
  const selected = probeResults.find((result) => result.supported && result.identity);
  if (!selected?.identity) {
    await db
      .update(sourceSubmissions)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(sourceSubmissions.id, submission.id));
    throw new Error("source_not_supported");
  }

  const identity = selected.identity;
  const name = identity.merchantName ?? identity.platformMerchantId;
  const slug = merchantSlug(identity.platformKind, identity.platformMerchantId);

  return db.transaction(async (tx) => {
    const [merchant] = await tx
      .insert(merchants)
      .values({ name, slug, websiteUrl: identity.canonicalEntryUrl })
      .onConflictDoUpdate({
        target: merchants.slug,
        set: { name, websiteUrl: identity.canonicalEntryUrl, updatedAt: new Date() },
      })
      .returning({ id: merchants.id });
    if (!merchant) throw new Error("merchant_upsert_failed");

    const now = new Date();
    const [source] = await tx
      .insert(sources)
      .values({
        merchantId: merchant.id,
        platformKind: identity.platformKind,
        platformMerchantId: identity.platformMerchantId,
        ...(identity.shopToken ? { shopToken: identity.shopToken } : {}),
        canonicalEntryUrl: identity.canonicalEntryUrl,
        submittedUrl: sourceUrl.toString(),
        collectorKind: selected.collectorKind,
        enabled: true,
        healthStatus: "retrying",
        nextRunAt: now,
      })
      .onConflictDoUpdate({
        target: [sources.platformKind, sources.platformMerchantId],
        set: {
          merchantId: merchant.id,
          ...(identity.shopToken ? { shopToken: identity.shopToken } : {}),
          canonicalEntryUrl: identity.canonicalEntryUrl,
          submittedUrl: sourceUrl.toString(),
          collectorKind: selected.collectorKind,
          enabled: true,
          healthStatus: "retrying",
          nextRunAt: now,
          updatedAt: now,
        },
      })
      .returning({ id: sources.id });
    if (!source) throw new Error("source_upsert_failed");

    await tx
      .update(sourceSubmissions)
      .set({
        status: "approved",
        name,
        detectedCollectorKind: selected.collectorKind,
        reviewedBy: "automatic_probe",
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(sourceSubmissions.id, submission.id));

    return {
      sourceId: source.id,
      submissionId: submission.id,
      collectorKind: selected.collectorKind,
      canonicalEntryUrl: identity.canonicalEntryUrl,
      merchantName: name,
    };
  });
}
