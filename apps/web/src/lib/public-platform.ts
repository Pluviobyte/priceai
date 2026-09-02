import { databasePool, query } from "./database";

export interface PublicHealthSummary {
  publishedAt: Date | null;
  generationId: string | null;
  sourceCount: number;
  healthySourceCount: number;
  failingSourceCount: number;
  runs24h: number;
  successfulRuns24h: number;
  runSuccessRate: number | null;
  currentOfferCount: number;
  staleOfferCount: number;
  staleRate: number | null;
  openAnomalyCount: number;
}

interface HealthRow {
  published_at: Date | null;
  generation_id: string | null;
  source_count: string;
  healthy_source_count: string;
  failing_source_count: string;
  runs_24h: string;
  successful_runs_24h: string;
  current_offer_count: string;
  stale_offer_count: string;
  open_anomaly_count: string;
}

export async function getPublicHealth(): Promise<PublicHealthSummary> {
  const [row] = await query<HealthRow>(
    `with publication as (
       select pc.current_generation_id generation_id,pg.published_at
         from publication_channels pc left join publish_generations pg on pg.id=pc.current_generation_id
        where pc.channel='card_prices' limit 1
     ), source_stats as (
       select count(*) filter (where health_status <> 'removed') source_count,
              count(*) filter (where enabled and health_status='healthy') healthy_source_count,
              count(*) filter (where enabled and health_status in ('retrying','failing')) failing_source_count
         from sources
     ), run_stats as (
       select count(*) runs_24h,
              count(*) filter (where status='success' and complete_snapshot) successful_runs_24h
         from crawl_runs where created_at > now() - interval '24 hours'
     ), offer_stats as (
       select count(*) current_offer_count,
              count(*) filter (where freshness_state='stale') stale_offer_count
         from offers o,publication p where o.publish_generation_id=p.generation_id
     ), anomaly_stats as (
       select count(*) open_anomaly_count from offer_anomalies where status='open'
     )
     select p.published_at,p.generation_id,s.*,r.*,o.*,a.*
       from publication p cross join source_stats s cross join run_stats r
       cross join offer_stats o cross join anomaly_stats a`,
  );
  const sourceCount = Number(row?.source_count ?? 0);
  const runs24h = Number(row?.runs_24h ?? 0);
  const successfulRuns24h = Number(row?.successful_runs_24h ?? 0);
  const currentOfferCount = Number(row?.current_offer_count ?? 0);
  const staleOfferCount = Number(row?.stale_offer_count ?? 0);
  return {
    publishedAt: row?.published_at ?? null,
    generationId: row?.generation_id ?? null,
    sourceCount,
    healthySourceCount: Number(row?.healthy_source_count ?? 0),
    failingSourceCount: Number(row?.failing_source_count ?? 0),
    runs24h,
    successfulRuns24h,
    runSuccessRate: runs24h ? successfulRuns24h / runs24h : null,
    currentOfferCount,
    staleOfferCount,
    staleRate: currentOfferCount ? staleOfferCount / currentOfferCount : null,
    openAnomalyCount: Number(row?.open_anomaly_count ?? 0),
  };
}

export async function resolveOutboundOffer(offerId: string): Promise<string | null> {
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ product_url: string }>(
      "select product_url from offers where id=$1 limit 1",
      [offerId],
    );
    const productUrl = result.rows[0]?.product_url;
    if (!productUrl) {
      await client.query("rollback");
      return null;
    }
    await client.query(
      `insert into outbound_click_daily (offer_id,day,click_count)
       values ($1,current_date,1)
       on conflict (offer_id,day) do update set
         click_count=outbound_click_daily.click_count+1,updated_at=now()`,
      [offerId],
    );
    await client.query("commit");
    return productUrl;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function consumePublicApiQuota(fingerprint: string, limit = 60): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}> {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const [row] = await query<{ request_count: number }>(
    `insert into api_rate_limit_windows (fingerprint,window_start,request_count)
     values ($1,$2,1)
     on conflict (fingerprint,window_start) do update set
       request_count=api_rate_limit_windows.request_count+1,updated_at=now()
     returning request_count`,
    [fingerprint, windowStart],
  );
  const count = row?.request_count ?? limit + 1;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: new Date(windowStart.getTime() + 60_000),
  };
}
