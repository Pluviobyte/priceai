\set ON_ERROR_STOP on
\if :{?web_password}
\else
  \quit
\endif

do $$ begin create role price_radar_web login; exception when duplicate_object then null; end $$;
do $$ begin create role price_radar_worker login; exception when duplicate_object then null; end $$;
do $$ begin create role price_radar_browser login; exception when duplicate_object then null; end $$;
alter role price_radar_web password :'web_password';
alter role price_radar_worker password :'worker_password';
alter role price_radar_browser password :'browser_password';

grant connect on database price_radar to price_radar_web,price_radar_worker,price_radar_browser;
grant usage on schema public to price_radar_web,price_radar_worker,price_radar_browser;
grant select,insert,update on all tables in schema public to price_radar_web;
grant usage,select on all sequences in schema public to price_radar_web;
grant select,insert,update,delete on all tables in schema public to price_radar_worker;
grant usage,select on all sequences in schema public to price_radar_worker;

grant select on sources,crawl_runs,raw_offer_snapshots,crawl_leases,semantic_duplicate_candidates to price_radar_browser;
grant insert on crawl_runs,raw_offer_snapshots,crawl_leases,semantic_duplicate_candidates,system_metric_samples,error_events to price_radar_browser;
grant update on sources,crawl_runs,crawl_leases to price_radar_browser;
grant update on semantic_duplicate_candidates to price_radar_browser;
grant delete on crawl_leases to price_radar_browser;
-- Official subscription prices collected through the browser (OpenAI checkout config).
grant select on canonical_products,exchange_rate_snapshots to price_radar_browser;
grant select,insert,update on official_subscription_plans,official_subscription_prices,official_subscription_checks,official_storefronts to price_radar_browser;
grant select,insert on official_subscription_price_history to price_radar_browser;
grant usage,select on all sequences in schema public to price_radar_browser;

alter default privileges in schema public grant select,insert,update on tables to price_radar_web;
alter default privileges in schema public grant select,insert,update,delete on tables to price_radar_worker;
