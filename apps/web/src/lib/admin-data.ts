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

export interface AdminSourceRow {
  id: string;
  merchantName: string;
  canonicalEntryUrl: string;
  collectorKind: string;
  enabled: boolean;
  healthStatus: string;
  consecutiveFailures: number;
  expectedProductCount: number | null;
  lastCheckedAt: Date | null;
  lastSuccessAt: Date | null;
  nextRunAt: Date | null;
  lastRunId: string | null;
  lastRunStatus: string | null;
  lastRunFetched: number | null;
  lastRunError: string | null;
}

export interface AdminRunDetail {
  id: string;
  sourceId: string;
  merchantName: string;
  collectorKind: string;
  collectorVersion: string;
  status: string;
  completeSnapshot: boolean;
  expectedTotal: number | null;
  fetchedTotal: number;
  parsedTotal: number;
  duplicateTotal: number;
  quarantinedTotal: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
  samples: Array<{
    sourceItemId: string;
    title: string;
    price: string | null;
    currency: string;
    stockCount: number | null;
    stockState: string;
    productUrl: string;
  }>;
}

export interface AdminAnomalyRow {
  id: string;
  kind: string;
  severity: string;
  title: string;
  sourceName: string;
  observedValue: unknown;
  baselineValue: unknown;
  detectedAt: Date;
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

interface SourceRow {
  id: string;
  merchant_name: string;
  canonical_entry_url: string;
  collector_kind: string;
  enabled: boolean;
  health_status: string;
  consecutive_failures: number;
  expected_product_count: number | null;
  last_checked_at: Date | null;
  last_success_at: Date | null;
  next_run_at: Date | null;
  last_run_id: string | null;
  last_run_status: string | null;
  last_run_fetched: number | null;
  last_run_error: string | null;
}

interface RunRow {
  id: string;
  source_id: string;
  merchant_name: string;
  collector_kind: string;
  collector_version: string;
  status: string;
  complete_snapshot: boolean;
  expected_total: number | null;
  fetched_total: number;
  parsed_total: number;
  duplicate_total: number;
  quarantined_total: number;
  started_at: Date | null;
  finished_at: Date | null;
  error_code: string | null;
  error_message: string | null;
}

interface SnapshotSampleRow {
  source_item_id: string;
  title: string;
  price: string | null;
  currency: string;
  stock_count: number | null;
  stock_state: string;
  product_url: string;
}

interface AdminAnomalyDetailRow {
  id: string;
  kind: string;
  severity: string;
  title: string;
  source_name: string;
  observed_value: unknown;
  baseline_value: unknown;
  detected_at: Date;
}

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

export async function getAdminSources(): Promise<AdminSourceRow[]> {
  const rows = await query<SourceRow>(
    `select s.id,
            coalesce(m.name, s.platform_merchant_id) as merchant_name,
            s.canonical_entry_url,
            s.collector_kind,
            s.enabled,
            s.health_status,
            s.consecutive_failures,
            s.expected_product_count,
            s.last_checked_at,
            s.last_success_at,
            s.next_run_at,
            lr.id as last_run_id,
            lr.status as last_run_status,
            lr.fetched_total as last_run_fetched,
            lr.error_message as last_run_error
       from sources s
       left join merchants m on m.id = s.merchant_id
       left join lateral (
         select cr.id, cr.status, cr.fetched_total, cr.error_message
           from crawl_runs cr
          where cr.source_id = s.id
          order by cr.created_at desc
          limit 1
       ) lr on true
      order by s.enabled desc, s.health_status, merchant_name`,
  );
  return rows.map((row) => ({
    id: row.id,
    merchantName: row.merchant_name,
    canonicalEntryUrl: row.canonical_entry_url,
    collectorKind: row.collector_kind,
    enabled: row.enabled,
    healthStatus: row.health_status,
    consecutiveFailures: row.consecutive_failures,
    expectedProductCount: row.expected_product_count,
    lastCheckedAt: row.last_checked_at,
    lastSuccessAt: row.last_success_at,
    nextRunAt: row.next_run_at,
    lastRunId: row.last_run_id,
    lastRunStatus: row.last_run_status,
    lastRunFetched: row.last_run_fetched,
    lastRunError: row.last_run_error,
  }));
}

export async function updateAdminSource(input: {
  sourceId: string;
  action: "enable" | "pause" | "retry";
  reason: string;
  actorId: string;
}): Promise<void> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const currentResult = await client.query<{
      enabled: boolean;
      health_status: string;
      next_run_at: Date | null;
    }>("select enabled, health_status, next_run_at from sources where id=$1 for update", [input.sourceId]);
    const current = currentResult.rows[0];
    if (!current) throw new Error("source_not_found");
    const enabled = input.action !== "pause";
    const healthStatus = input.action === "pause" ? "paused" : "retrying";
    const nextRunAt = input.action === "pause" ? current.next_run_at : new Date();
    await client.query(
      `update sources
          set enabled=$2, health_status=$3, next_run_at=$4, updated_at=now()
        where id=$1`,
      [input.sourceId, enabled, healthStatus, nextRunAt],
    );
    await client.query(
      `insert into audit_logs
         (actor_id, action, target_type, target_id, reason, before_value, after_value)
       values ($1,$2,'source',$3,$4,$5::jsonb,$6::jsonb)`,
      [
        input.actorId,
        `source.${input.action}`,
        input.sourceId,
        input.reason,
        JSON.stringify(current),
        JSON.stringify({ enabled, healthStatus, nextRunAt }),
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

export async function getAdminRun(runId: string): Promise<AdminRunDetail | null> {
  const [run] = await query<RunRow>(
    `select cr.id, cr.source_id, coalesce(m.name,s.platform_merchant_id) merchant_name,
            cr.collector_kind, cr.collector_version, cr.status, cr.complete_snapshot,
            cr.expected_total, cr.fetched_total, cr.parsed_total, cr.duplicate_total,
            cr.quarantined_total, cr.started_at, cr.finished_at, cr.error_code, cr.error_message
       from crawl_runs cr
       join sources s on s.id=cr.source_id
       left join merchants m on m.id=s.merchant_id
      where cr.id=$1 limit 1`,
    [runId],
  );
  if (!run) return null;
  const samples = await query<SnapshotSampleRow>(
    `select source_item_id, raw_title title, raw_price_numeric price, currency,
            stock_count, stock_state_hint stock_state, product_url
       from raw_offer_snapshots
      where crawl_run_id=$1
      order by raw_title
      limit 100`,
    [runId],
  );
  return {
    id: run.id,
    sourceId: run.source_id,
    merchantName: run.merchant_name,
    collectorKind: run.collector_kind,
    collectorVersion: run.collector_version,
    status: run.status,
    completeSnapshot: run.complete_snapshot,
    expectedTotal: run.expected_total,
    fetchedTotal: run.fetched_total,
    parsedTotal: run.parsed_total,
    duplicateTotal: run.duplicate_total,
    quarantinedTotal: run.quarantined_total,
    startedAt: run.started_at,
    finishedAt: run.finished_at,
    errorCode: run.error_code,
    errorMessage: run.error_message,
    samples: samples.map((sample) => ({
      sourceItemId: sample.source_item_id,
      title: sample.title,
      price: sample.price,
      currency: sample.currency,
      stockCount: sample.stock_count,
      stockState: sample.stock_state,
      productUrl: sample.product_url,
    })),
  };
}

export async function getAdminAnomalies(): Promise<AdminAnomalyRow[]> {
  const rows = await query<AdminAnomalyDetailRow>(
    `select oa.id, oa.kind, oa.severity, ros.raw_title title,
            coalesce(m.name,s.platform_merchant_id) source_name,
            oa.observed_value, oa.baseline_value, oa.detected_at
       from offer_anomalies oa
       join raw_offer_snapshots ros on ros.id=oa.raw_offer_snapshot_id
       join sources s on s.id=ros.source_id and s.latest_complete_run_id=ros.crawl_run_id
       left join merchants m on m.id=s.merchant_id
      where oa.status='open'
      order by case oa.severity when 'critical' then 1 when 'warning' then 2 else 3 end,
               oa.detected_at desc
      limit 300`,
  );
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    sourceName: row.source_name,
    observedValue: row.observed_value,
    baselineValue: row.baseline_value,
    detectedAt: row.detected_at,
  }));
}

export async function resolveAdminAnomaly(input: {
  anomalyId: string;
  action: "resolve" | "ignore";
  reason: string;
  actorId: string;
}): Promise<void> {
  const status = input.action === "ignore" ? "ignored" : "resolved";
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ id: string; status: string }>(
      "select id,status from offer_anomalies where id=$1 for update",
      [input.anomalyId],
    );
    const current = result.rows[0];
    if (!current) throw new Error("anomaly_not_found");
    await client.query(
      "update offer_anomalies set status=$2,resolved_at=now() where id=$1",
      [input.anomalyId, status],
    );
    await client.query(
      `insert into audit_logs
         (actor_id, action, target_type, target_id, reason, before_value, after_value)
       values ($1,$2,'offer_anomaly',$3,$4,$5::jsonb,$6::jsonb)`,
      [
        input.actorId,
        `anomaly.${input.action}`,
        input.anomalyId,
        input.reason,
        JSON.stringify({ status: current.status }),
        JSON.stringify({ status }),
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
