import { query } from "@/lib/database";

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
  const lines = [
    metric("price_radar_enabled_sources", "Enabled collection sources", Number(row?.enabled_sources ?? 0)),
    metric("price_radar_current_offers", "Offers in current generation", Number(row?.current_offers ?? 0)),
    metric("price_radar_open_anomalies", "Open offer anomalies", Number(row?.open_anomalies ?? 0)),
    metric("price_radar_crawls_24h", "Crawl runs in the last 24 hours", Number(row?.crawls_24h ?? 0)),
    metric("price_radar_complete_crawls_24h", "Complete crawl runs in the last 24 hours", Number(row?.complete_crawls_24h ?? 0)),
    metric("price_radar_notification_backlog", "Queued notification deliveries", Number(row?.notification_backlog ?? 0)),
    metric("price_radar_errors_24h", "Unresolved errors observed in the last 24 hours", Number(row?.errors_24h ?? 0)),
    metric("price_radar_metrics_query_ms", "Metrics query latency in milliseconds", performance.now() - started),
  ];
  return new Response(`${lines.join("\n")}\n`, { headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
