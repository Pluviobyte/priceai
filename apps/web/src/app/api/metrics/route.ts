import { query, getDatabaseMetrics } from "@/lib/database";
import { getChannelCacheStats, getChannelReadModelCacheStats } from "@/lib/catalog-read-cache";
import { getHomeCacheStats } from "@/lib/home-snapshot";

export const dynamic = "force-dynamic";

function metric(name: string, help: string, value: number) { return `# HELP ${name} ${help}\n# TYPE ${name} gauge\n${name} ${value}`; }

export async function GET() {
  const started = performance.now();
  const [row] = await query<Record<string, string>>(
    `with current as (select current_generation_id id from publication_channels where channel='card_prices')
     select (select count(*) from sources where enabled)::text enabled_sources,
            (select count(*) from offers o,current c where o.publish_generation_id=c.id)::text current_offers,
            (select count(*) from offer_anomalies where status='open')::text open_anomalies,
            (select count(*) from crawl_runs where created_at>now()-interval '24 hours')::text crawls_24h,
            (select count(*) from crawl_runs where created_at>now()-interval '24 hours' and complete_snapshot)::text complete_crawls_24h,
            (select count(*) from notification_outbox where status in ('queued','processing'))::text notification_backlog,
            (select count(*) from error_events where resolved_at is null and occurred_at>now()-interval '24 hours')::text errors_24h`,
  );
  const database = getDatabaseMetrics();
  const channelCache = getChannelCacheStats();
  const channelReadModel = getChannelReadModelCacheStats();
  const homeCache = getHomeCacheStats();
  const lines = [
    metric("price_radar_enabled_sources", "Enabled collection sources", Number(row?.enabled_sources ?? 0)),
    metric("price_radar_current_offers", "Offers in current generation", Number(row?.current_offers ?? 0)),
    metric("price_radar_open_anomalies", "Open offer anomalies", Number(row?.open_anomalies ?? 0)),
    metric("price_radar_crawls_24h", "Crawl runs in the last 24 hours", Number(row?.crawls_24h ?? 0)),
    metric("price_radar_complete_crawls_24h", "Complete crawl runs in the last 24 hours", Number(row?.complete_crawls_24h ?? 0)),
    metric("price_radar_notification_backlog", "Queued notification deliveries", Number(row?.notification_backlog ?? 0)),
    metric("price_radar_errors_24h", "Unresolved errors observed in the last 24 hours", Number(row?.errors_24h ?? 0)),
    metric("price_radar_web_instrumented_db_in_flight_requests", "Instrumented Web reads executing or waiting for a pool slot", database.inFlight),
    metric("price_radar_web_instrumented_db_peak_in_flight_requests", "Peak instrumented Web reads executing or waiting since process start", database.peakInFlight),
    metric("price_radar_web_db_pool_total", "Connections currently owned by the Web pool", database.poolTotal),
    metric("price_radar_web_db_pool_idle", "Idle connections in the Web pool", database.poolIdle),
    metric("price_radar_web_db_pool_busy", "Connections currently busy in the Web pool", database.poolBusy),
    metric("price_radar_web_db_pool_waiting", "Requests waiting for a Web database connection", database.poolWaiting),
    metric("price_radar_web_instrumented_db_request_failures_total", "Failed instrumented Web reads since process start", database.failed),
    metric("price_radar_web_instrumented_db_request_timeouts_total", "Timed out instrumented Web reads since process start", database.timedOut),
    metric("price_radar_web_instrumented_db_slow_requests_total", "Instrumented Web reads taking at least two seconds including pool wait", database.slow),
    metric("price_radar_web_instrumented_db_average_request_ms", "Average instrumented Web read duration including pool wait", database.averageDurationMs),
    metric("price_radar_web_channel_cache_hits_total", "Publication-scoped channel cache hits", channelCache.hits),
    metric("price_radar_web_channel_cache_misses_total", "Publication-scoped channel cache misses", channelCache.misses),
    metric("price_radar_web_channel_cache_coalesced_total", "Channel requests joined to an in-flight read", channelCache.coalesced),
    metric("price_radar_web_channel_cache_entries", "Channel cache entries currently retained", channelCache.size),
    metric("price_radar_web_channel_read_model_hits_total", "Generation-level channel read model cache hits", channelReadModel.hits),
    metric("price_radar_web_channel_read_model_misses_total", "Generation-level channel read model cache misses", channelReadModel.misses),
    metric("price_radar_web_channel_read_model_coalesced_total", "Channel requests sharing an in-flight read model load", channelReadModel.coalesced),
    metric("price_radar_web_home_cache_hits_total", "Publication-scoped homepage cache hits", homeCache.hits),
    metric("price_radar_web_home_cache_misses_total", "Publication-scoped homepage cache misses", homeCache.misses),
    metric("price_radar_web_home_cache_coalesced_total", "Homepage requests joined to an in-flight read", homeCache.coalesced),
    metric("price_radar_metrics_query_ms", "Metrics query latency in milliseconds", performance.now() - started),
  ];
  return new Response(`${lines.join("\n")}\n`, { headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
