import { createHash } from "node:crypto";
import { query } from "./database";

export async function getLatestFeedPointer() {
  const [row] = await query<{ id: string; published_at: Date; offer_count: number; manifest_hash: string | null }>(
    `select g.id,g.published_at,g.offer_count,g.manifest_hash
       from publication_channels c join publish_generations g on g.id=c.current_generation_id
      where c.channel='card_prices' limit 1`,
  );
  return row ? { generationId: row.id, publishedAt: row.published_at, offerCount: row.offer_count, manifestSha256: row.manifest_hash, snapshotUrl: `/api/v1/feed/snapshots/${row.id}` } : null;
}

export async function buildGenerationFeed(generationId: string) {
  const [generation] = await query<Record<string, unknown> & { id: string }>(
    "select id,published_at,offer_count,product_count,source_count from publish_generations where id=$1 and status in ('published','superseded') limit 1",
    [generationId],
  );
  if (!generation) return null;
  const offers = await query<Record<string, unknown>>(
    `select ps.source_item_id,cp.slug as product_slug,cp.display_name as product_name,
            m.name as merchant_name,ps.price,ps.currency,ps.stock_count,ps.stock_state,
            ps.availability_state,ps.freshness_state,ps.risk_facts,ps.offer_mode,
            ps.product_url,ps.offer_verified_at,ros.raw_title,ros.raw_price_text
       from published_offer_snapshots ps
       join canonical_products cp on cp.id=ps.canonical_product_id
       join sources s on s.id=ps.source_id
       join merchants m on m.id=s.merchant_id
       join raw_offer_snapshots ros on ros.id=ps.latest_raw_snapshot_id
      where ps.publish_generation_id=$1 order by cp.slug,ps.price`,
    [generationId],
  );
  const body = JSON.stringify({ schemaVersion: 1, generation, offers });
  return { body, sha256: createHash("sha256").update(body).digest("hex"), offerCount: offers.length };
}
