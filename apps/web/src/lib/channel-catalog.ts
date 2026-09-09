import { query } from "./database";
import { CHANNEL_MODES, catalogView, type ChannelFilters, type ChannelSpec } from "./channel-filters";

export interface ChannelRow {
  id: string;
  spec_key: string;
  product_slug: string;
  product_name: string;
  platform: string;
  merchant_slug: string;
  merchant_name: string;
  /** Entry URL of the shop, so two merchants sharing a display name stay distinguishable. */
  merchant_host: string | null;
  raw_title: string;
  offer_mode: string;
  duration_days: number | null;
  region: string | null;
  account_ownership: string;
  warranty_type: string;
  warranty_hours: number | null;
  currency: string;
  price: string | null;
  stock_state: string;
  stock_count: number | null;
  verified_at: Date | null;
  available: boolean;
  risk_facts: string[];
  offer_count: number;
  available_count: number;
  merchant_count: number;
}

export interface ChannelCatalog {
  rows: ChannelRow[];
  total: number;
  page: number;
  pageSize: number;
  offerCount: number;
  merchantCount: number;
  availableCount: number;
  latest: Date | null;
  /** The locked specification described in full, so the reader can see what they are held to. */
  spec: ChannelSpec | null;
}

// Only published, active sources appear here. All minimum prices use fresh,
// explicitly in-stock offers; unknown inventory is displayed but never called in stock.
const BASE = `with published as (
  select current_generation_id from publication_channels where channel='card_prices'
), catalog as (
  select o.id::text, cp.slug product_slug, cp.display_name product_name, cp.brand platform,
    m.slug merchant_slug, m.name merchant_name, s.canonical_entry_url merchant_host, ros.raw_title, o.offer_mode,
    oa.duration_days, oa.region, coalesce(oa.account_ownership,'unknown') account_ownership,
    coalesce(oa.warranty_type,'unknown') warranty_type, oa.warranty_hours,
    o.currency, o.price, o.stock_state, o.stock_count, o.offer_verified_at verified_at,
    coalesce(o.availability_state='purchasable'
      and o.stock_state in ('in_stock','low_stock') and (o.stock_count is null or o.stock_count>0)
      and o.offer_verified_at>now()-interval '24 hours', false) available,
    o.risk_facts,
    md5(jsonb_build_array(cp.slug,o.offer_mode,oa.duration_days,o.currency,oa.region,
      coalesce(oa.account_ownership,'unknown'),coalesce(oa.warranty_type,'unknown'),oa.warranty_hours,
      case when oa.duration_days is null then o.id::text else null end)::text) spec_key
  from offers o
  join canonical_products cp on cp.id=o.canonical_product_id
  join sources s on s.id=o.source_id
  join merchants m on m.id=s.merchant_id
  join raw_offer_snapshots ros on ros.id=o.latest_raw_snapshot_id
  join offer_matches om on om.raw_offer_snapshot_id=ros.id
  left join offer_attributes oa on oa.offer_match_id=om.id
  where o.publish_generation_id=(select current_generation_id from published)
    and o.availability_state<>'quarantined' and cp.status='active' and m.status='active'
    and s.enabled=true and s.health_status not in ('removed','paused')
    and o.offer_mode=any($1::text[])
)`;

export async function getChannelCatalog(filters: ChannelFilters, read: typeof query = query): Promise<ChannelCatalog> {
  const view = catalogView(filters);
  const values: unknown[] = [Object.keys(CHANNEL_MODES)];
  const conditions: string[] = [];
  const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (filters.q) {
    const pattern = parameter(`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`);
    conditions.push(`concat_ws(' ',product_name,platform,raw_title,merchant_name) ilike ${pattern} escape '\\'`);
  }
  if (filters.platform) conditions.push(`platform=${parameter(filters.platform)}`);
  if (filters.mode) conditions.push(`offer_mode=${parameter(filters.mode)}`);
  if (filters.duration) conditions.push(`duration_days=${parameter(Number(filters.duration))}`);
  if (filters.warranty) conditions.push(`warranty_type=${parameter(filters.warranty)}`);
  if (filters.currency) conditions.push(`currency=${parameter(filters.currency)}`);
  if (filters.spec) conditions.push(`spec_key=${parameter(filters.spec)}`);
  if (filters.stock === "available") conditions.push("available=true");
  const filtered = `${BASE}, filtered as (select * from catalog${conditions.length ? ` where ${conditions.join(" and ")}` : ""})`;
  // Preserve delivery, duration, currency, region, ownership and warranty boundaries.
  // When duration is unknown, do not merge unrelated offers into a minimum price.
  const group = `spec_key,product_slug,product_name,platform,offer_mode,duration_days,currency,
    region,account_ownership,warranty_type,warranty_hours,
    case when duration_days is null then id else null end`;
  const selection = view === "products"
    ? `select min(id) id, spec_key,product_slug,product_name,platform,offer_mode,duration_days,currency,
        region,account_ownership,warranty_type,warranty_hours,min(merchant_host) merchant_host,
        min(price) filter (where available and duration_days>0) price,
        count(*)::int offer_count, count(distinct merchant_slug)::int merchant_count,
        count(*) filter (where available)::int available_count, max(verified_at) verified_at
       from filtered group by ${group}`
    : view === "merchants"
      ? `select merchant_slug id, merchant_slug,merchant_name,min(merchant_host) merchant_host,count(*)::int offer_count,
          count(*) filter (where available)::int available_count,
          count(distinct product_slug)::int merchant_count,max(verified_at) verified_at,
          null::numeric price, ''::text currency
         from filtered group by merchant_slug,merchant_name`
      : `select *,1::int offer_count,available::int available_count,1::int merchant_count from filtered`;
  const cte = `${filtered}, results as (${selection})`;
  const [summary] = await read<{
    total: number; offer_count: number; merchant_count: number; available_count: number; latest: Date | null;
  }>(`${cte} select (select count(*)::int from results) total,
      count(*)::int offer_count,count(distinct merchant_slug)::int merchant_count,
      count(*) filter (where available)::int available_count,max(verified_at) latest from filtered`, values);
  const pageSize = 24;
  const total = summary?.total ?? 0;
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / pageSize)));
  const order = filters.sort === "price" && view !== "merchants"
    ? "currency asc,price asc nulls last,verified_at desc nulls last"
    : filters.sort === "offers" ? "offer_count desc,verified_at desc nulls last"
      : "verified_at desc nulls last,available_count desc";
  const rows = await read<ChannelRow>(`${cte} select * from results order by ${order},id
    limit ${parameter(pageSize)} offset ${parameter((page - 1) * pageSize)}`, values);
  // Resolved from the specification alone, so the lock stays legible even when the
  // other filters return nothing and on the merchant tab, where rows carry no spec.
  const [spec] = filters.spec
    ? await read<ChannelSpec>(`${BASE} select product_slug,product_name,platform,offer_mode,duration_days,
        region,account_ownership,warranty_type,warranty_hours,currency
       from catalog where spec_key=$2 limit 1`, [Object.keys(CHANNEL_MODES), filters.spec])
    : [];
  return { rows, total, page, pageSize, offerCount: summary?.offer_count ?? 0,
    merchantCount: summary?.merchant_count ?? 0, availableCount: summary?.available_count ?? 0,
    latest: summary?.latest ?? null, spec: spec ?? null };
}
