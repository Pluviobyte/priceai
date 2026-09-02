import { and, desc, eq } from "drizzle-orm";
import {
  auditLogs,
  canonicalProducts,
  classificationOverrides,
  offerMatches,
  rawOfferSnapshots,
  type Database,
} from "@price-radar/database";

export interface ReviewQueueItem {
  matchId: string;
  snapshotId: string;
  sourceId: string;
  sourceItemId: string;
  title: string;
  category: string | null;
  price: string | null;
  confidence: string;
  matchedRules: string[];
  conflictingSignals: string[];
  productSlug: string | null;
  capturedAt: Date;
}

export interface ReviewDecision {
  matchId: string;
  action: "approve" | "reject" | "correct";
  canonicalProductSlug?: string;
  attributeOverrides?: Record<string, unknown>;
  reason: string;
  actorId: string;
}

export async function listReviewQueue(
  db: Database,
  limit = 100,
): Promise<ReviewQueueItem[]> {
  const rows = await db
    .select({
      matchId: offerMatches.id,
      snapshotId: rawOfferSnapshots.id,
      sourceId: rawOfferSnapshots.sourceId,
      sourceItemId: rawOfferSnapshots.sourceItemId,
      title: rawOfferSnapshots.rawTitle,
      category: rawOfferSnapshots.rawCategory,
      price: rawOfferSnapshots.rawPriceNumeric,
      confidence: offerMatches.confidence,
      matchedRules: offerMatches.matchedRules,
      conflictingSignals: offerMatches.conflictingSignals,
      productSlug: canonicalProducts.slug,
      capturedAt: rawOfferSnapshots.capturedAt,
    })
    .from(offerMatches)
    .innerJoin(rawOfferSnapshots, eq(offerMatches.rawOfferSnapshotId, rawOfferSnapshots.id))
    .leftJoin(canonicalProducts, eq(offerMatches.canonicalProductId, canonicalProducts.id))
    .where(eq(offerMatches.reviewStatus, "pending"))
    .orderBy(desc(rawOfferSnapshots.capturedAt))
    .limit(limit);
  return rows;
}

export async function decideReview(
  db: Database,
  decision: ReviewDecision,
): Promise<{ overrideId: string; reviewStatus: string }> {
  if (!decision.reason.trim()) throw new Error("review_reason_required");
  const [target] = await db
    .select({
      matchId: offerMatches.id,
      snapshotId: rawOfferSnapshots.id,
      sourceId: rawOfferSnapshots.sourceId,
      sourceItemId: rawOfferSnapshots.sourceItemId,
      currentProductId: offerMatches.canonicalProductId,
      currentReviewStatus: offerMatches.reviewStatus,
    })
    .from(offerMatches)
    .innerJoin(rawOfferSnapshots, eq(offerMatches.rawOfferSnapshotId, rawOfferSnapshots.id))
    .where(eq(offerMatches.id, decision.matchId))
    .limit(1);
  if (!target) throw new Error("review_target_not_found");

  let productId = target.currentProductId;
  if (decision.canonicalProductSlug) {
    const [product] = await db
      .select({ id: canonicalProducts.id })
      .from(canonicalProducts)
      .where(eq(canonicalProducts.slug, decision.canonicalProductSlug))
      .limit(1);
    if (!product) throw new Error("canonical_product_not_found");
    productId = product.id;
  }
  if (decision.action !== "reject" && !productId) {
    throw new Error("canonical_product_required");
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const overrideDecision = decision.action === "reject" ? "reject" : "approve";
    const [override] = await tx
      .insert(classificationOverrides)
      .values({
        sourceId: target.sourceId,
        sourceItemId: target.sourceItemId,
        ...(productId ? { canonicalProductId: productId } : {}),
        decision: overrideDecision,
        attributeOverrides: decision.attributeOverrides ?? {},
        reason: decision.reason.trim(),
        createdBy: decision.actorId,
        active: true,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [classificationOverrides.sourceId, classificationOverrides.sourceItemId],
        set: {
          canonicalProductId: productId,
          decision: overrideDecision,
          attributeOverrides: decision.attributeOverrides ?? {},
          reason: decision.reason.trim(),
          createdBy: decision.actorId,
          active: true,
          updatedAt: now,
        },
      })
      .returning({ id: classificationOverrides.id });
    if (!override) throw new Error("classification_override_upsert_failed");

    const reviewStatus = decision.action === "reject" ? "rejected" : "manual_approved";
    await tx
      .update(offerMatches)
      .set({
        canonicalProductId: decision.action === "reject" ? null : productId,
        confidence: "1",
        reviewStatus,
      })
      .where(and(eq(offerMatches.id, target.matchId), eq(offerMatches.rawOfferSnapshotId, target.snapshotId)));
    await tx.insert(auditLogs).values({
      actorId: decision.actorId,
      action: `classification.${decision.action}`,
      targetType: "offer_match",
      targetId: target.matchId,
      reason: decision.reason.trim(),
      beforeValue: {
        canonicalProductId: target.currentProductId,
        reviewStatus: target.currentReviewStatus,
      },
      afterValue: {
        canonicalProductId: decision.action === "reject" ? null : productId,
        reviewStatus,
        attributeOverrides: decision.attributeOverrides ?? {},
      },
    });
    return { overrideId: override.id, reviewStatus };
  });
}
