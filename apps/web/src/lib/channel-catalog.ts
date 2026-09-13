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
  merchant_platforms?: string[];
  merchant_products?: string[];
  comparable_count?: number;
  lowest_count?: number;
  top_five_count?: number;
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
  /** Lowest price among offers that actually carry a warranty; null when none do. */
  warranty_price?: string | null;
  unavailable_count?: number;
  /** The shop and its own wording behind the lowest price, so the number is traceable. */
  lowest_merchant_name?: string | null;
  lowest_raw_title?: string | null;
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
    -- Which catalogue a product belongs to is a fact about the product, not about how
    -- one shop happens to deliver one of its offers. Tabbing on the delivery put nine
    -- products in two catalogues at once: ChatGPT Plus sat under 周边 because a shop
    -- mentioned "api" in its boilerplate, which reads as the same category twice.
    (cp.slug like 'resource-%') is_resource,
    m.slug merchant_slug, m.name merchant_name, s.canonical_entry_url merchant_host, ros.raw_title, o.offer_mode,
    oa.duration_days, oa.region, coalesce(oa.account_ownership,'unknown') account_ownership,
    coalesce(oa.warranty_type,'unknown') warranty_type, oa.warranty_hours,
    o.currency, o.price, o.stock_state, o.stock_count, o.offer_verified_at verified_at,
    coalesce(o.availability_state='purchasable'
      and o.stock_state in ('in_stock','low_stock') and (o.stock_count is null or o.stock_count>0)
      and o.offer_verified_at>now()-interval '24 hours', false) available,
    o.risk_facts,
    case when (cp.slug like 'resource-%')
      then md5(jsonb_build_array(cp.slug,o.currency,oa.region,coalesce(oa.account_ownership,'unknown'))::text)
      else md5(jsonb_build_array(cp.slug,o.offer_mode,oa.duration_days,o.currency,oa.region,
        coalesce(oa.account_ownership,'unknown'),coalesce(oa.warranty_type,'unknown'),oa.warranty_hours,
        case when oa.duration_days is null or o.offer_mode='unknown' then o.id::text else null end)::text)
    end spec_key
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
    conditions.push(`concat_ws(' ',product_name,platform,raw_title,merchant_name,merchant_host) ilike ${pattern} escape '\\'`);
  }
  // Bare accounts carry no tier, so they sit beside the tier they are not: a ¥0.7
  // registered account under ChatGPT Plus reads as a second Plus row at an impossible
  // price. They stay in the catalogue, under their own heading.
  conditions.push(filters.catalog === 'resources' ? "is_resource=true"
    : filters.catalog === 'accounts' ? "is_resource=false and product_slug like '%-account'"
      : "is_resource=false and product_slug not like '%-account'");
  if (filters.platform) conditions.push(`platform=${parameter(filters.platform)}`);
  if (filters.mode) conditions.push(`offer_mode=${parameter(filters.mode)}`);
  if (filters.duration) conditions.push(`duration_days=${parameter(Number(filters.duration))}`);
  if (filters.warranty) conditions.push(`warranty_type=${parameter(filters.warranty)}`);
  if (filters.currency) conditions.push(`currency=${parameter(filters.currency)}`);
  if (filters.spec) conditions.push(`spec_key=${parameter(filters.spec)}`);
  if (filters.product) conditions.push(`product_slug=${parameter(filters.product)}`);
  if (filters.stock === "available") conditions.push("available=true");
  // A comparable price needs a known delivery and a real term. Ranking the rest of the
  // row by it lets one product occupy one row while the number stays traceable to the
  // offer behind it. A price a tenth of its product's median is a placeholder or a
  // misfiled item, never a real floor, so it is kept out of the minimum.
  // An offer whose delivery is undetermined never sets a price, fallback included.
  const termed = `available and duration_days>0 and offer_mode<>'unknown' and raw_title !~* '补差价|定金|预付'`;
  const comparable = `${termed} and offer_mode in ('recharge','finished_account','redeem_code','team_seat')`;
  // A product whose entire market is sold one way — Ultra only as family seats, say —
  // has no offer in the strict set, and a blank price reads as a broken page rather
  // than as the honest "nobody sells this outright". So the fallback compares that
  // product against itself, and the row still names the delivery it priced.
  const filtered = `${BASE}, filtered as (select * from catalog${conditions.length ? ` where ${conditions.join(" and ")}` : ""})
    , priced as (select *, case when ${comparable} then price end cmp,
        case when ${termed} then price end alt from filtered)
    , medians as materialized (select product_slug, currency, count(cmp) strict_n,
        percentile_cont(0.5) within group (order by cmp) med_cmp,
        percentile_cont(0.5) within group (order by alt) med_alt
        from priced group by product_slug, currency)
    , chosen as (select p.*, case when m.strict_n>0 then p.cmp else p.alt end pick,
        case when m.strict_n>0 then m.med_cmp else m.med_alt end med
        from priced p left join medians m using (product_slug, currency))
    , ranked as (select *, case when pick is not null
        and (med is null or is_resource or pick > med*0.1) then pick end cmp_ok from chosen)`;
  // spec_key already encodes every boundary that makes two offers comparable, so the
  // grouping follows it. Subscriptions keep delivery, duration and warranty apart and an
  // unknown duration still stands alone; resources merge, having no term or tier.
  // One row per product, as a shopper reads the page. The specification that produced
  // the minimum is carried on the row, so the price still says what it belongs to.
  const group = `product_slug,product_name,platform,currency`;
  // Rank one fresh minimum per merchant/spec against the full catalog. Search must
  // not turn the selected merchant into its own sole competitor.
  const merchantRanking = view === "merchants" ? `, merchant_prices as (
    select merchant_slug,spec_key,min(price) price from catalog
    where available and duration_days>0 and offer_mode in ('recharge','finished_account','redeem_code','team_seat') and price is not null
    group by merchant_slug,spec_key
  ), ranked_prices as (
    select *,rank() over (partition by spec_key order by price) price_rank,
      count(*) over (partition by spec_key) competitors from merchant_prices
  ), matched_specs as (
    select distinct merchant_slug,spec_key from filtered where available and duration_days>0 and offer_mode in ('recharge','finished_account','redeem_code','team_seat')
  ), merchant_scores as (
    select r.merchant_slug,count(*)::int comparable_count,
      count(*) filter (where price_rank=1)::int lowest_count,
      count(*) filter (where price_rank<=5)::int top_five_count
    from ranked_prices r join matched_specs f using (merchant_slug,spec_key)
    where competitors>=2 group by r.merchant_slug
  )` : "";
  const selection = view === "products"
    ? `select min(id) id,
        (array_agg(spec_key order by cmp_ok asc nulls last))[1] spec_key,
        product_slug,product_name,platform,currency,
        case when bool_or(is_resource) then 'unknown'
          else (array_agg(offer_mode order by cmp_ok asc nulls last))[1] end offer_mode,
        case when bool_or(is_resource) then null
          else (array_agg(duration_days order by cmp_ok asc nulls last))[1] end duration_days,
        (array_agg(region order by cmp_ok asc nulls last))[1] region,
        (array_agg(account_ownership order by cmp_ok asc nulls last))[1] account_ownership,
        case when bool_or(is_resource) then 'unknown'
          else (array_agg(warranty_type order by cmp_ok asc nulls last))[1] end warranty_type,
        case when bool_or(is_resource) then null
          else (array_agg(warranty_hours order by cmp_ok asc nulls last))[1] end warranty_hours,
        min(merchant_host) merchant_host,
        min(cmp_ok) price,
        min(cmp_ok) filter (where warranty_type not in ('none','unknown')) warranty_price,
        (array_agg(merchant_name order by cmp_ok asc nulls last))[1] lowest_merchant_name,
        (array_agg(raw_title order by cmp_ok asc nulls last))[1] lowest_raw_title,
        count(*)::int offer_count, count(distinct merchant_slug)::int merchant_count,
        count(*) filter (where available)::int available_count,
        count(*) filter (where not available)::int unavailable_count, max(verified_at) verified_at
       from ranked group by ${group}`
    : view === "merchants"
      ? `select merchant_slug id, merchant_slug,merchant_name,min(merchant_host) merchant_host,count(*)::int offer_count,
          count(*) filter (where available)::int available_count,
          count(distinct product_slug)::int merchant_count,max(verified_at) verified_at,
          array_agg(distinct platform order by platform) merchant_platforms,
          array_agg(distinct product_name order by product_name) merchant_products,
          coalesce(max(ms.comparable_count),0)::int comparable_count,
          coalesce(max(ms.lowest_count),0)::int lowest_count,
          coalesce(max(ms.top_five_count),0)::int top_five_count,
          null::numeric price, ''::text currency
         from filtered left join merchant_scores ms using (merchant_slug)
         group by merchant_slug,merchant_name`
      : `select *,1::int offer_count,available::int available_count,1::int merchant_count from ranked`;
  const cte = `${filtered}${merchantRanking}, results as (${selection})`;
  const [summary] = await read<{
    total: number; offer_count: number; merchant_count: number; available_count: number; latest: Date | null;
  }>(`${cte} select (select count(*)::int from results) total,
      count(*)::int offer_count,count(distinct merchant_slug)::int merchant_count,
      count(*) filter (where available)::int available_count,max(verified_at) latest from ranked`, values);
  const pageSize = 24;
  const total = summary?.total ?? 0;
  const page = Math.min(filters.page, Math.max(1, Math.ceil(total / pageSize)));
  const order = filters.sort === "low_price" && view === "merchants"
    ? "lowest_count desc,top_five_count desc,comparable_count desc,available_count desc,verified_at desc nulls last"
    : filters.sort === "price" && view !== "merchants"
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
