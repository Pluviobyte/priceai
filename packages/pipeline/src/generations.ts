import { eq, sql } from "drizzle-orm";
import {
  auditLogs,
  publicationChannels,
  publishGenerations,
  publishedOfferSnapshots,
  type Database,
} from "@price-radar/database";
import type { RawObjectStore } from "./catalog.js";

export async function rollbackPublication(
  database: Database,
  input: { channel?: string; targetGenerationId: string; actorId: string; reason: string },
): Promise<{ currentGenerationId: string; previousGenerationId: string; restoredOffers: number }> {
  const channel = input.channel ?? "card_prices";
  return database.transaction(async (tx) => {
    const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(718231, 1) as acquired`);
    if (!lock.rows[0]?.acquired) throw new Error('publication_busy');
    const [pointer] = await tx.select().from(publicationChannels).where(eq(publicationChannels.channel, channel)).limit(1);
    if (!pointer?.currentGenerationId) throw new Error("publication_channel_empty");
    if (pointer.currentGenerationId === input.targetGenerationId) throw new Error("generation_already_current");
    const [target] = await tx.select({ id: publishGenerations.id, status: publishGenerations.status, snapshotState: publishGenerations.snapshotState }).from(publishGenerations).where(eq(publishGenerations.id, input.targetGenerationId)).limit(1);
    if (!target || !["published", "superseded"].includes(target.status)) throw new Error("generation_not_rollback_eligible");
    if (target.snapshotState !== 'retained') throw new Error('generation_snapshot_expired');
    const [snapshot] = await tx.select({ id: publishedOfferSnapshots.id }).from(publishedOfferSnapshots).where(eq(publishedOfferSnapshots.publishGenerationId, target.id)).limit(1);
    if (!snapshot) throw new Error("generation_snapshot_missing");

    await tx.execute(sql`update offers set publish_generation_id=null,updated_at=now() where publish_generation_id=${pointer.currentGenerationId}::uuid`);
    await tx.execute(sql`
      insert into offers (
        source_id,source_item_id,canonical_product_id,latest_raw_snapshot_id,price,currency,
        stock_count,stock_state,availability_state,freshness_state,risk_facts,offer_mode,
        product_url,first_seen_at,last_seen_at,offer_verified_at,last_checked_at,
        classification_confidence,quarantine_reason,publish_generation_id,created_at,updated_at
      )
      select source_id,source_item_id,canonical_product_id,latest_raw_snapshot_id,price,currency,
        stock_count,stock_state,availability_state,freshness_state,risk_facts,offer_mode,
        product_url,first_seen_at,last_seen_at,offer_verified_at,last_checked_at,
        classification_confidence,quarantine_reason,${target.id}::uuid,now(),now()
      from published_offer_snapshots where publish_generation_id=${target.id}::uuid
      on conflict (source_id,source_item_id) do update set
        canonical_product_id=excluded.canonical_product_id,
        latest_raw_snapshot_id=excluded.latest_raw_snapshot_id,price=excluded.price,
        currency=excluded.currency,stock_count=excluded.stock_count,stock_state=excluded.stock_state,
        availability_state=excluded.availability_state,freshness_state=excluded.freshness_state,
        risk_facts=excluded.risk_facts,offer_mode=excluded.offer_mode,product_url=excluded.product_url,
        first_seen_at=excluded.first_seen_at,last_seen_at=excluded.last_seen_at,
        offer_verified_at=excluded.offer_verified_at,last_checked_at=excluded.last_checked_at,
        classification_confidence=excluded.classification_confidence,
        quarantine_reason=excluded.quarantine_reason,publish_generation_id=excluded.publish_generation_id,
        updated_at=now()
    `);
    const countResult = await tx.execute(sql`select count(*)::int as count from published_offer_snapshots where publish_generation_id=${target.id}::uuid`);
    const restoredOffers = Number((countResult.rows[0] as { count?: number } | undefined)?.count ?? 0);
    await tx.update(publishGenerations).set({ status: "superseded" }).where(eq(publishGenerations.id, pointer.currentGenerationId));
    await tx.update(publishGenerations).set({ status: "published" }).where(eq(publishGenerations.id, target.id));
    await tx.update(publicationChannels).set({ currentGenerationId: target.id, previousGenerationId: pointer.currentGenerationId, updatedAt: new Date() }).where(eq(publicationChannels.channel, channel));
    await tx.insert(auditLogs).values({ actorId: input.actorId, action: "publication.rollback", targetType: "publish_generation", targetId: target.id, reason: input.reason, beforeValue: { currentGenerationId: pointer.currentGenerationId }, afterValue: { currentGenerationId: target.id, restoredOffers } });
    return { currentGenerationId: target.id, previousGenerationId: pointer.currentGenerationId, restoredOffers };
  });
}

export async function storePublicGenerationSnapshot(database: Database, objectStore: RawObjectStore, generationId: string) {
  const prepared = await database.transaction(async tx => {
    await tx.execute(sql`set local statement_timeout='5s'`);
    const generationResult = await tx.execute(sql`
      select id,published_at,offer_count,product_count,source_count,manifest_url,manifest_hash,snapshot_state from publish_generations where id=${generationId}::uuid limit 1
    `);
    const generation = generationResult.rows[0] as Record<string, unknown> | undefined;
    if (!generation) throw new Error("generation_not_found");
    if (generation.snapshot_state !== 'retained') throw new Error('generation_snapshot_expired');
    if (generation.manifest_url && generation.manifest_hash) return { cached: {
      uri: String(generation.manifest_url), sha256: String(generation.manifest_hash), offerCount: Number(generation.offer_count),
    } };
    delete generation.manifest_url; delete generation.manifest_hash; delete generation.snapshot_state;
    const offersResult = await tx.execute(sql`
      select ps.source_item_id,cp.slug as product_slug,cp.display_name as product_name,
             m.name as merchant_name,ps.price,ps.currency,ps.stock_count,ps.stock_state,
             ps.availability_state,ps.freshness_state,ps.risk_facts,ps.offer_mode,
             ps.product_url,ps.offer_verified_at,ros.raw_title,ros.raw_price_text
        from published_offer_snapshots ps
        join canonical_products cp on cp.id=ps.canonical_product_id
        join sources s on s.id=ps.source_id
        join merchants m on m.id=s.merchant_id
        join raw_offer_snapshots ros on ros.id=ps.latest_raw_snapshot_id
       where ps.publish_generation_id=${generationId}::uuid
       order by cp.slug,ps.price,ps.source_id,ps.source_item_id
    `);
    if (offersResult.rows.length !== Number(generation.offer_count)) throw new Error('generation_snapshot_incomplete');
    return { payload: { schemaVersion: 1, generation, offers: offersResult.rows } };
  }, { isolationLevel: 'repeatable read', accessMode: 'read only' });
  if (prepared.cached) return prepared.cached;
  const payload = prepared.payload!;
  const stored = await objectStore.putJson(`public-generations/${generationId}.json`, payload);
  await database.update(publishGenerations).set({ manifestUrl: stored.uri, manifestHash: stored.sha256 }).where(eq(publishGenerations.id, generationId));
  return { ...stored, offerCount: payload.offers.length };
}
