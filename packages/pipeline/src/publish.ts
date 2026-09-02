import { and, eq, notInArray, sql } from "drizzle-orm";
import { classifyOffer } from "@price-radar/classifier";
import { detectOfferAnomalies } from "@price-radar/anomaly-detector";
import {
  canonicalProducts,
  classificationOverrides,
  offerAttributes,
  offerAnomalies,
  offerMatches,
  offerPriceHistory,
  offers,
  publicationChannels,
  publishGenerations,
  rawOfferSnapshots,
  sources,
  type Database,
} from "@price-radar/database";
import { evaluateOfferEligibility } from "@price-radar/ranking";
import {
  offerAttributesSchema,
  rawOfferInputSchema,
  type ClassificationResult,
  type FreshnessState,
} from "@price-radar/schema";

export interface PublishOptions {
  channel?: string;
  now?: Date;
  allowEmpty?: boolean;
}

export interface PublishResult {
  generationId: string;
  previousGenerationId: string | null;
  offerCount: number;
  productCount: number;
  sourceCount: number;
  quarantinedCount: number;
}

function freshnessFor(capturedAt: Date, now: Date): FreshnessState {
  const ageMs = now.getTime() - capturedAt.getTime();
  if (ageMs <= 6 * 60 * 60_000) return "fresh";
  if (ageMs <= 24 * 60 * 60_000) return "aging";
  return "stale";
}

export async function publishLatestSnapshots(
  db: Database,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const channel = options.channel ?? "card_prices";
  const now = options.now ?? new Date();
  const rows = await db
    .select({ raw: rawOfferSnapshots, source: sources })
    .from(rawOfferSnapshots)
    .innerJoin(
      sources,
      and(
        eq(rawOfferSnapshots.sourceId, sources.id),
        eq(rawOfferSnapshots.crawlRunId, sources.latestCompleteRunId),
      ),
    )
    .where(eq(sources.enabled, true));

  if (rows.length === 0 && !options.allowEmpty) {
    throw new Error("publish_refused_empty_snapshot");
  }

  const products = await db.select().from(canonicalProducts);
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const overrides = await db
    .select()
    .from(classificationOverrides)
    .where(eq(classificationOverrides.active, true));
  const overrideBySourceItem = new Map(
    overrides.map((override) => [
      `${override.sourceId}:${override.sourceItemId}`,
      override,
    ]),
  );

  return db.transaction(async (tx) => {
    const [publication] = await tx
      .select()
      .from(publicationChannels)
      .where(eq(publicationChannels.channel, channel))
      .limit(1);
    const previousGenerationId = publication?.currentGenerationId ?? null;
    if (previousGenerationId) {
      await tx.execute(sql`
        insert into published_offer_snapshots (
          publish_generation_id,offer_id,source_id,source_item_id,canonical_product_id,
          latest_raw_snapshot_id,price,currency,stock_count,stock_state,availability_state,
          freshness_state,risk_facts,offer_mode,product_url,first_seen_at,last_seen_at,
          offer_verified_at,last_checked_at,classification_confidence,quarantine_reason,captured_at
        )
        select ${previousGenerationId}::uuid,id,source_id,source_item_id,canonical_product_id,
          latest_raw_snapshot_id,price,currency,stock_count,stock_state,availability_state,
          freshness_state,risk_facts,offer_mode,product_url,first_seen_at,last_seen_at,
          offer_verified_at,last_checked_at,classification_confidence,quarantine_reason,${now}
        from offers where publish_generation_id=${previousGenerationId}::uuid
        on conflict (publish_generation_id,source_id,source_item_id) do nothing
      `);
    }
    const [generation] = await tx
      .insert(publishGenerations)
      .values({ status: "staging", previousGenerationId })
      .returning({ id: publishGenerations.id });
    if (!generation) throw new Error("publish_generation_insert_failed");

    const productIds = new Set<string>();
    const sourceIds = new Set<string>();
    let offerCount = 0;
    let quarantinedCount = 0;

    for (const row of rows) {
      const raw = rawOfferInputSchema.parse({
        sourceItemId: row.raw.sourceItemId,
        rawTitle: row.raw.rawTitle,
        ...(row.raw.rawDescription ? { rawDescription: row.raw.rawDescription } : {}),
        ...(row.raw.rawCategory ? { rawCategory: row.raw.rawCategory } : {}),
        rawPriceText: row.raw.rawPriceText,
        price: row.raw.rawPriceNumeric,
        currency: row.raw.currency,
        ...(row.raw.rawStock !== null ? { rawStock: row.raw.rawStock } : {}),
        ...(row.raw.stockCount !== null ? { stockCount: row.raw.stockCount } : {}),
        stockState: row.raw.stockStateHint,
        productUrl: row.raw.productUrl,
        ...(row.raw.sourceUpdatedAt
          ? { sourceUpdatedAt: row.raw.sourceUpdatedAt.toISOString() }
          : {}),
        capturedAt: row.raw.capturedAt.toISOString(),
        rawPayloadHash: row.raw.rawPayloadHash,
      });
      const [existing] = await tx
        .select({
          id: offers.id,
          price: offers.price,
          stockCount: offers.stockCount,
          stockState: offers.stockState,
        })
        .from(offers)
        .where(
          and(
            eq(offers.sourceId, row.source.id),
            eq(offers.sourceItemId, raw.sourceItemId),
          ),
        )
        .limit(1);
      const automaticClassification = classifyOffer(raw);
      const classificationOverride = overrideBySourceItem.get(
        `${row.source.id}:${raw.sourceItemId}`,
      );
      let classification: ClassificationResult = automaticClassification;
      if (classificationOverride) {
        const overrideProduct = classificationOverride.canonicalProductId
          ? productById.get(classificationOverride.canonicalProductId)
          : undefined;
        const attributes = offerAttributesSchema.safeParse({
          ...automaticClassification.attributes,
          ...classificationOverride.attributeOverrides,
        });
        classification = {
          ...automaticClassification,
          canonicalProductSlug:
            classificationOverride.decision === "reject"
              ? null
              : overrideProduct?.slug ?? automaticClassification.canonicalProductSlug,
          attributes: attributes.success
            ? attributes.data
            : automaticClassification.attributes,
          confidence: 1,
          matchedRules: [
            ...automaticClassification.matchedRules,
            `manual:${classificationOverride.decision}`,
          ],
          conflictingSignals: attributes.success
            ? automaticClassification.conflictingSignals
            : [
                ...automaticClassification.conflictingSignals,
                "invalid_manual_attribute_override",
              ],
          requiresReview: false,
        };
      }
      const product = classification.canonicalProductSlug
        ? productBySlug.get(classification.canonicalProductSlug)
        : undefined;
      const reviewStatus = classificationOverride
        ? classificationOverride.decision === "reject"
          ? "rejected"
          : "manual_approved"
        : classification.requiresReview
          ? "pending"
          : "auto_approved";
      const detectedAnomalies = classificationOverride?.decision === "reject"
        ? []
        : detectOfferAnomalies({
            price: raw.price,
            ...(raw.stockCount !== undefined ? { stockCount: raw.stockCount } : {}),
            stockState: raw.stockState,
            classificationConfidence: classification.confidence,
            canonicalProductSlug: classification.canonicalProductSlug,
            ...(existing ? { previousPrice: existing.price } : {}),
          });
      const anomalyKinds = detectedAnomalies.map((anomaly) => anomaly.kind);
      await tx
        .update(offerAnomalies)
        .set({ status: "resolved", resolvedAt: now })
        .where(
          anomalyKinds.length > 0
            ? and(
                eq(offerAnomalies.rawOfferSnapshotId, row.raw.id),
                notInArray(offerAnomalies.kind, anomalyKinds),
              )
            : eq(offerAnomalies.rawOfferSnapshotId, row.raw.id),
        );
      for (const anomaly of detectedAnomalies) {
        await tx
          .insert(offerAnomalies)
          .values({
            rawOfferSnapshotId: row.raw.id,
            sourceId: row.source.id,
            ...(existing ? { offerId: existing.id } : {}),
            kind: anomaly.kind,
            severity: anomaly.severity,
            ...(anomaly.observedValue !== undefined
              ? { observedValue: anomaly.observedValue }
              : {}),
            ...(anomaly.baselineValue !== undefined
              ? { baselineValue: anomaly.baselineValue }
              : {}),
            details: anomaly.details,
            status: "open",
            detectedAt: now,
          })
          .onConflictDoUpdate({
            target: [offerAnomalies.rawOfferSnapshotId, offerAnomalies.kind],
            set: {
              severity: anomaly.severity,
              ...(anomaly.observedValue !== undefined
                ? { observedValue: anomaly.observedValue }
                : {}),
              ...(anomaly.baselineValue !== undefined
                ? { baselineValue: anomaly.baselineValue }
                : {}),
              details: anomaly.details,
              status: sql`case when ${offerAnomalies.status} = 'ignored' then 'ignored' else 'open' end`,
              detectedAt: now,
              resolvedAt: sql`case when ${offerAnomalies.status} = 'ignored' then ${offerAnomalies.resolvedAt} else null end`,
            },
          });
      }
      const [match] = await tx
        .insert(offerMatches)
        .values({
          rawOfferSnapshotId: row.raw.id,
          ...(product ? { canonicalProductId: product.id } : {}),
          confidence: String(classification.confidence),
          matchedRules: classification.matchedRules,
          conflictingSignals: classification.conflictingSignals,
          classifierVersion: classification.classifierVersion,
          reviewStatus,
        })
        .onConflictDoUpdate({
          target: offerMatches.rawOfferSnapshotId,
          set: {
            ...(product ? { canonicalProductId: product.id } : { canonicalProductId: null }),
            confidence: String(classification.confidence),
            matchedRules: classification.matchedRules,
            conflictingSignals: classification.conflictingSignals,
            classifierVersion: classification.classifierVersion,
            reviewStatus,
          },
        })
        .returning({ id: offerMatches.id });
      if (!match) throw new Error("offer_match_upsert_failed");

      const attributes = classification.attributes;
      await tx
        .insert(offerAttributes)
        .values({
          offerMatchId: match.id,
          offerMode: attributes.offerMode,
          ...(attributes.durationDays !== undefined
            ? { durationDays: attributes.durationDays }
            : {}),
          ...(attributes.region ? { region: attributes.region } : {}),
          accountOwnership: attributes.accountOwnership,
          ...(attributes.phoneBound !== undefined ? { phoneBound: attributes.phoneBound } : {}),
          ...(attributes.emailType ? { emailType: attributes.emailType } : {}),
          warrantyType: attributes.warrantyType,
          ...(attributes.warrantyHours !== undefined
            ? { warrantyHours: attributes.warrantyHours }
            : {}),
          ...(attributes.autoDelivery !== undefined
            ? { autoDelivery: attributes.autoDelivery }
            : {}),
          ...(attributes.webAvailable !== undefined
            ? { webAvailable: attributes.webAvailable }
            : {}),
          ...(attributes.desktopAvailable !== undefined
            ? { desktopAvailable: attributes.desktopAvailable }
            : {}),
          ...(attributes.apiAvailable !== undefined
            ? { apiAvailable: attributes.apiAvailable }
            : {}),
          ...(attributes.shared !== undefined ? { shared: attributes.shared } : {}),
          ...(attributes.invoiceAvailable !== undefined
            ? { invoiceAvailable: attributes.invoiceAvailable }
            : {}),
          riskFacts: attributes.riskFacts,
        })
        .onConflictDoUpdate({
          target: offerAttributes.offerMatchId,
          set: {
            offerMode: attributes.offerMode,
            durationDays: attributes.durationDays ?? null,
            region: attributes.region ?? null,
            accountOwnership: attributes.accountOwnership,
            phoneBound: attributes.phoneBound ?? null,
            emailType: attributes.emailType ?? null,
            warrantyType: attributes.warrantyType,
            warrantyHours: attributes.warrantyHours ?? null,
            autoDelivery: attributes.autoDelivery ?? null,
            webAvailable: attributes.webAvailable ?? null,
            desktopAvailable: attributes.desktopAvailable ?? null,
            apiAvailable: attributes.apiAvailable ?? null,
            shared: attributes.shared ?? null,
            invoiceAvailable: attributes.invoiceAvailable ?? null,
            riskFacts: attributes.riskFacts,
          },
        });

      if (!product) {
        quarantinedCount += 1;
        continue;
      }

      const freshnessState = freshnessFor(row.raw.capturedAt, now);
      const eligibility = evaluateOfferEligibility({
        price: raw.price,
        ...(raw.stockCount !== undefined ? { stockCount: raw.stockCount } : {}),
        stockState: raw.stockState,
        freshnessState,
        classificationConfidence: classification.confidence,
        offerMode: attributes.offerMode,
      });
      const quarantineReason = eligibility.reasons.length
        ? eligibility.reasons.join(",")
        : null;
      if (eligibility.availabilityState === "quarantined") quarantinedCount += 1;

      const [publishedOffer] = await tx
        .insert(offers)
        .values({
          sourceId: row.source.id,
          sourceItemId: raw.sourceItemId,
          canonicalProductId: product.id,
          latestRawSnapshotId: row.raw.id,
          price: raw.price,
          currency: raw.currency,
          ...(raw.stockCount !== undefined ? { stockCount: raw.stockCount } : {}),
          stockState: raw.stockState,
          availabilityState: eligibility.availabilityState,
          freshnessState,
          riskFacts: attributes.riskFacts,
          offerMode: attributes.offerMode,
          productUrl: raw.productUrl,
          lastSeenAt: now,
          offerVerifiedAt: now,
          lastCheckedAt: now,
          classificationConfidence: String(classification.confidence),
          quarantineReason,
          publishGenerationId: generation.id,
        })
        .onConflictDoUpdate({
          target: [offers.sourceId, offers.sourceItemId],
          set: {
            canonicalProductId: product.id,
            latestRawSnapshotId: row.raw.id,
            price: raw.price,
            currency: raw.currency,
            stockCount: raw.stockCount ?? null,
            stockState: raw.stockState,
            availabilityState: eligibility.availabilityState,
            freshnessState,
            riskFacts: attributes.riskFacts,
            offerMode: attributes.offerMode,
            productUrl: raw.productUrl,
            lastSeenAt: now,
            offerVerifiedAt: now,
            lastCheckedAt: now,
            classificationConfidence: String(classification.confidence),
            quarantineReason,
            publishGenerationId: generation.id,
            updatedAt: now,
          },
        })
        .returning({ id: offers.id });
      if (!publishedOffer) throw new Error("offer_upsert_failed");
      if (detectedAnomalies.length > 0) {
        await tx
          .update(offerAnomalies)
          .set({ offerId: publishedOffer.id })
          .where(eq(offerAnomalies.rawOfferSnapshotId, row.raw.id));
      }

      const changed =
        !existing ||
        existing.price !== raw.price ||
        existing.stockCount !== (raw.stockCount ?? null) ||
        existing.stockState !== raw.stockState;
      if (changed) {
        await tx.insert(offerPriceHistory).values({
          offerId: publishedOffer.id,
          price: raw.price,
          currency: raw.currency,
          ...(raw.stockCount !== undefined ? { stockCount: raw.stockCount } : {}),
          stockState: raw.stockState,
          observedAt: now,
          crawlRunId: row.raw.crawlRunId,
        });
      }

      offerCount += 1;
      productIds.add(product.id);
      sourceIds.add(row.source.id);
    }

    if (offerCount === 0 && !options.allowEmpty) {
      throw new Error("publish_refused_no_classified_offers");
    }
    await tx.execute(sql`
      insert into published_offer_snapshots (
        publish_generation_id,offer_id,source_id,source_item_id,canonical_product_id,
        latest_raw_snapshot_id,price,currency,stock_count,stock_state,availability_state,
        freshness_state,risk_facts,offer_mode,product_url,first_seen_at,last_seen_at,
        offer_verified_at,last_checked_at,classification_confidence,quarantine_reason,captured_at
      )
      select ${generation.id}::uuid,id,source_id,source_item_id,canonical_product_id,
        latest_raw_snapshot_id,price,currency,stock_count,stock_state,availability_state,
        freshness_state,risk_facts,offer_mode,product_url,first_seen_at,last_seen_at,
        offer_verified_at,last_checked_at,classification_confidence,quarantine_reason,${now}
      from offers where publish_generation_id=${generation.id}::uuid
      on conflict (publish_generation_id,source_id,source_item_id) do nothing
    `);
    await tx
      .update(publishGenerations)
      .set({
        status: "published",
        publishedAt: now,
        offerCount,
        productCount: productIds.size,
        sourceCount: sourceIds.size,
      })
      .where(eq(publishGenerations.id, generation.id));
    if (previousGenerationId) {
      await tx
        .update(publishGenerations)
        .set({ status: "superseded" })
        .where(eq(publishGenerations.id, previousGenerationId));
    }
    await tx
      .insert(publicationChannels)
      .values({
        channel,
        currentGenerationId: generation.id,
        previousGenerationId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: publicationChannels.channel,
        set: {
          currentGenerationId: generation.id,
          previousGenerationId,
          updatedAt: now,
        },
      });

    return {
      generationId: generation.id,
      previousGenerationId,
      offerCount,
      productCount: productIds.size,
      sourceCount: sourceIds.size,
      quarantinedCount,
    };
  });
}
