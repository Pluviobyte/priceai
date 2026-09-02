import { databasePool, query } from "./database";

export interface AdminReviewItem {
  matchId: string;
  title: string;
  category: string | null;
  price: string | null;
  confidence: string;
  productSlug: string | null;
  sourceName: string;
  sourceItemId: string;
  capturedAt: Date;
}

export interface AdminProduct {
  slug: string;
  name: string;
}

export interface AdminAnomalySummary {
  kind: string;
  severity: string;
  count: number;
}

interface ReviewRow {
  match_id: string;
  title: string;
  category: string | null;
  price: string | null;
  confidence: string;
  product_slug: string | null;
  source_name: string;
  source_item_id: string;
  captured_at: Date;
}

interface ProductRow { slug: string; name: string }
interface AnomalyRow { kind: string; severity: string; count: string }

export async function getAdminDashboard(): Promise<{
  reviews: AdminReviewItem[];
  products: AdminProduct[];
  anomalies: AdminAnomalySummary[];
}> {
  const [reviewRows, productRows, anomalyRows] = await Promise.all([
    query<ReviewRow>(
      `select om.id as match_id,
              ros.raw_title as title,
              ros.raw_category as category,
              ros.raw_price_numeric as price,
              om.confidence,
              cp.slug as product_slug,
              m.name as source_name,
              ros.source_item_id,
              ros.captured_at
         from offer_matches om
         join raw_offer_snapshots ros on ros.id = om.raw_offer_snapshot_id
         join sources s on s.id = ros.source_id and s.latest_complete_run_id = ros.crawl_run_id
         left join merchants m on m.id = s.merchant_id
         left join canonical_products cp on cp.id = om.canonical_product_id
        where om.review_status = 'pending'
        order by ros.captured_at desc, om.confidence asc
        limit 150`,
    ),
    query<ProductRow>(
      `select slug, display_name as name
         from canonical_products
        where status = 'active'
        order by brand, display_name`,
    ),
    query<AnomalyRow>(
      `select oa.kind, oa.severity, count(*)::text as count
         from offer_anomalies oa
         join raw_offer_snapshots ros on ros.id = oa.raw_offer_snapshot_id
         join sources s on s.id = ros.source_id and s.latest_complete_run_id = ros.crawl_run_id
        where oa.status = 'open'
        group by oa.kind, oa.severity
        order by case oa.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
                 count(*) desc`,
    ),
  ]);

  return {
    reviews: reviewRows.map((row) => ({
      matchId: row.match_id,
      title: row.title,
      category: row.category,
      price: row.price,
      confidence: row.confidence,
      productSlug: row.product_slug,
      sourceName: row.source_name,
      sourceItemId: row.source_item_id,
      capturedAt: row.captured_at,
    })),
    products: productRows,
    anomalies: anomalyRows.map((row) => ({
      kind: row.kind,
      severity: row.severity,
      count: Number(row.count),
    })),
  };
}

export async function saveReviewDecision(input: {
  matchId: string;
  action: "approve" | "reject" | "correct";
  canonicalProductSlug?: string;
  reason: string;
  actorId: string;
}): Promise<void> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const targetResult = await client.query<{
      source_id: string;
      source_item_id: string;
      canonical_product_id: string | null;
      review_status: string;
    }>(
      `select ros.source_id, ros.source_item_id, om.canonical_product_id, om.review_status
         from offer_matches om
         join raw_offer_snapshots ros on ros.id = om.raw_offer_snapshot_id
        where om.id = $1
        for update`,
      [input.matchId],
    );
    const target = targetResult.rows[0];
    if (!target) throw new Error("review_target_not_found");

    let productId = target.canonical_product_id;
    if (input.canonicalProductSlug) {
      const productResult = await client.query<{ id: string }>(
        "select id from canonical_products where slug = $1 and status = 'active' limit 1",
        [input.canonicalProductSlug],
      );
      productId = productResult.rows[0]?.id ?? null;
      if (!productId) throw new Error("canonical_product_not_found");
    }
    if (input.action !== "reject" && !productId) throw new Error("canonical_product_required");

    const overrideResult = await client.query<{ id: string }>(
      `insert into classification_overrides
         (source_id, source_item_id, canonical_product_id, decision, reason, created_by, active)
       values ($1, $2, $3, $4, $5, $6, true)
       on conflict (source_id, source_item_id) do update set
         canonical_product_id = excluded.canonical_product_id,
         decision = excluded.decision,
         reason = excluded.reason,
         created_by = excluded.created_by,
         active = true,
         updated_at = now()
       returning id`,
      [
        target.source_id,
        target.source_item_id,
        input.action === "reject" ? null : productId,
        input.action === "reject" ? "reject" : "approve",
        input.reason,
        input.actorId,
      ],
    );
    const overrideId = overrideResult.rows[0]?.id;
    if (!overrideId) throw new Error("classification_override_upsert_failed");
    const reviewStatus = input.action === "reject" ? "rejected" : "manual_approved";
    await client.query(
      `update offer_matches
          set canonical_product_id = $2, confidence = 1, review_status = $3
        where id = $1`,
      [input.matchId, input.action === "reject" ? null : productId, reviewStatus],
    );
    await client.query(
      `insert into audit_logs
         (actor_id, action, target_type, target_id, reason, before_value, after_value)
       values ($1, $2, 'offer_match', $3, $4, $5::jsonb, $6::jsonb)`,
      [
        input.actorId,
        `classification.${input.action}`,
        input.matchId,
        input.reason,
        JSON.stringify({
          canonicalProductId: target.canonical_product_id,
          reviewStatus: target.review_status,
        }),
        JSON.stringify({
          canonicalProductId: input.action === "reject" ? null : productId,
          reviewStatus,
          overrideId,
        }),
      ],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
