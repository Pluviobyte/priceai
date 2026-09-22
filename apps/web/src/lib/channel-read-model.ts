import type { QueryResultRow } from "pg";
import { CHANNEL_MODES, catalogView, type ChannelFilters, type ChannelSpec } from "./channel-filters";
import type { ChannelCatalog, ChannelRow } from "./channel-catalog";
import { query } from "./database";

export interface CatalogOffer extends QueryResultRow {
  generation_id: string;
  id: string;
  product_slug: string;
  product_name: string;
  platform: string;
  category: string;
  is_resource: boolean;
  merchant_slug: string;
  merchant_name: string;
  merchant_host: string | null;
  raw_title: string;
  offer_mode: string;
  duration_days: number | null;
  region: string | null;
  account_ownership: string;
  warranty_type: string;
  warranty_hours: number | null;
  currency: string;
  price: string;
  stock_state: string;
  stock_count: number | null;
  verified_at: Date | null;
  available: boolean;
  risk_facts: string[];
  spec_key: string;
}

export interface ChannelReadModel { generationId: string | null; offers: CatalogOffer[] }

const READ_MODEL_SQL = `with published as (
  select $2::uuid current_generation_id
), catalog as (
  select o.id::text,cp.slug product_slug,
    cp.display_name product_name,cp.brand platform,cp.category,(cp.slug like 'resource-%') is_resource,
    m.slug merchant_slug,m.name merchant_name,s.canonical_entry_url merchant_host,ros.raw_title,o.offer_mode,
    oa.duration_days,oa.region,coalesce(oa.account_ownership,'unknown') account_ownership,
    coalesce(oa.warranty_type,'unknown') warranty_type,oa.warranty_hours,o.currency,o.price,o.stock_state,
    o.stock_count,o.offer_verified_at verified_at,coalesce(o.availability_state='purchasable'
      and o.stock_state in ('in_stock','low_stock') and (o.stock_count is null or o.stock_count>0)
      and o.offer_verified_at>now()-interval '24 hours',false) available,o.risk_facts,
    case when cp.slug like 'resource-%'
      then md5(jsonb_build_array(cp.slug,o.currency,oa.region,coalesce(oa.account_ownership,'unknown'))::text)
      else md5(jsonb_build_array(cp.slug,o.offer_mode,oa.duration_days,o.currency,oa.region,
        coalesce(oa.account_ownership,'unknown'),coalesce(oa.warranty_type,'unknown'),oa.warranty_hours,
        case when oa.duration_days is null or o.offer_mode='unknown' then o.id::text else null end)::text)
    end spec_key
  from published p join offers o on o.publish_generation_id=p.current_generation_id
  join canonical_products cp on cp.id=o.canonical_product_id join sources s on s.id=o.source_id
  join merchants m on m.id=s.merchant_id join raw_offer_snapshots ros on ros.id=o.latest_raw_snapshot_id
  join offer_matches om on om.raw_offer_snapshot_id=ros.id left join offer_attributes oa on oa.offer_match_id=om.id
  where o.availability_state<>'quarantined' and cp.status='active' and m.status='active'
    and s.enabled=true and s.health_status not in ('removed','paused') and o.offer_mode=any($1::text[])
) select p.current_generation_id::text generation_id,c.* from published p left join catalog c on true`;

export async function loadChannelReadModel(generationId: string | null, read: typeof query = query): Promise<ChannelReadModel> {
  if (generationId === null) return { generationId: null, offers: [] };
  const rows = await read<CatalogOffer & { id: string | null }>(READ_MODEL_SQL, [Object.keys(CHANNEL_MODES), generationId]);
  return { generationId: rows[0]?.generation_id ?? null, offers: rows.filter((row): row is CatalogOffer => row.id !== null) };
}

const number = (value: string | number | null | undefined) => value == null ? null : Number(value);
const time = (value: Date | null) => value?.getTime() ?? -Infinity;
const median = (values: number[]) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b), middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
};
const minText = (values: Array<string | null>) => values.filter((v): v is string => v != null).sort()[0] ?? null;
const maxDate = (values: Array<Date | null>) => values.reduce<Date | null>((latest, value) => time(value) > time(latest) ? value : latest, null);

function matches(offer: CatalogOffer, filters: ChannelFilters) {
  if (filters.q && ![offer.product_name,offer.platform,offer.raw_title,offer.merchant_name,offer.merchant_host]
    .filter(Boolean).join(" ").toLocaleLowerCase().includes(filters.q.toLocaleLowerCase())) return false;
  if (filters.category ? offer.category !== filters.category
    : filters.catalog === "resources" ? !offer.is_resource
      : filters.catalog === "accounts" ? offer.is_resource || !offer.product_slug.endsWith("-account")
        : offer.is_resource || offer.product_slug.endsWith("-account")) return false;
  if (filters.platform && offer.platform !== filters.platform) return false;
  if (filters.mode && offer.offer_mode !== filters.mode) return false;
  if (filters.duration && offer.duration_days !== Number(filters.duration)) return false;
  if (filters.warranty && offer.warranty_type !== filters.warranty) return false;
  if (filters.currency && offer.currency !== filters.currency) return false;
  if (filters.spec && offer.spec_key !== filters.spec) return false;
  if (filters.product && offer.product_slug !== filters.product) return false;
  return filters.stock !== "available" || offer.available;
}

function isTermed(offer: CatalogOffer) {
  const price = number(offer.price);
  return offer.available && (offer.is_resource || (offer.duration_days ?? 0) > 0) && offer.offer_mode !== "unknown"
    && price !== null && price >= 0.02 && !/补差价|定金|预付/u.test(offer.raw_title);
}
function isComparable(offer: CatalogOffer) {
  return isTermed(offer) && ["recharge","finished_account","redeem_code","team_seat"].includes(offer.offer_mode);
}
function isMerchantComparable(offer: CatalogOffer) {
  return offer.available && (offer.duration_days ?? 0) > 0 && ["recharge","finished_account","redeem_code","team_seat"].includes(offer.offer_mode)
    && number(offer.price) !== null;
}

interface RankedOffer extends CatalogOffer { cmp_ok: number | null }

function rankOffers(offers: CatalogOffer[]): RankedOffer[] {
  const groups = new Map<string, { strict: number[]; alternate: number[] }>();
  for (const offer of offers) {
    const key = `${offer.product_slug}\0${offer.currency}`;
    const group = groups.get(key) ?? { strict: [], alternate: [] };
    if (isComparable(offer)) group.strict.push(Number(offer.price));
    if (isTermed(offer)) group.alternate.push(Number(offer.price));
    groups.set(key, group);
  }
  return offers.map(offer => {
    const group = groups.get(`${offer.product_slug}\0${offer.currency}`)!;
    const strict = group.strict.length > 0, pick = strict ? (isComparable(offer) ? Number(offer.price) : null)
      : isTermed(offer) ? Number(offer.price) : null;
    const marketMedian = median(strict ? group.strict : group.alternate);
    return { ...offer, cmp_ok: pick !== null && (marketMedian === null || offer.is_resource || pick > marketMedian * 0.1) ? pick : null };
  });
}

function bestOffer(rows: RankedOffer[]) {
  return [...rows].sort((a,b) => (a.cmp_ok ?? Infinity)-(b.cmp_ok ?? Infinity) || a.id.localeCompare(b.id))[0]!;
}

function productRows(ranked: RankedOffer[]): ChannelRow[] {
  const groups = new Map<string, RankedOffer[]>();
  for (const row of ranked) {
    const key = `${row.product_slug}\0${row.product_name}\0${row.platform}\0${row.currency}`;
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  return [...groups.values()].map(rows => {
    const best = bestOffer(rows), prices = rows.map(row => row.cmp_ok).filter((v): v is number => v !== null);
    const warranty = rows.filter(row => !["none","unknown"].includes(row.warranty_type))
      .map(row => row.cmp_ok).filter((v): v is number => v !== null);
    return { ...best, id:[...rows].map(row=>row.id).sort()[0]!, spec_key:best.spec_key,
      offer_mode:best.is_resource?"unknown":best.offer_mode,duration_days:best.is_resource?null:best.duration_days,
      warranty_type:best.is_resource?"unknown":best.warranty_type,warranty_hours:best.is_resource?null:best.warranty_hours,
      merchant_host:minText(rows.map(row=>row.merchant_host)),price:prices.length?String(Math.min(...prices)):null,
      warranty_price:warranty.length?String(Math.min(...warranty)):null,lowest_merchant_name:best.merchant_name,
      lowest_raw_title:best.raw_title,offer_count:rows.length,merchant_count:new Set(rows.map(row=>row.merchant_slug)).size,
      available_count:rows.filter(row=>row.available).length,unavailable_count:rows.filter(row=>!row.available).length,
      verified_at:maxDate(rows.map(row=>row.verified_at)) };
  });
}

function merchantScores(all: CatalogOffer[], filtered: CatalogOffer[]) {
  const prices = new Map<string, Map<string, number>>();
  for (const row of all) if (isMerchantComparable(row)) {
    const byMerchant=prices.get(row.spec_key)??new Map<string,number>();
    byMerchant.set(row.merchant_slug,Math.min(byMerchant.get(row.merchant_slug)??Infinity,Number(row.price)));
    prices.set(row.spec_key,byMerchant);
  }
  const matched=new Map<string,Set<string>>();
  for(const row of filtered)if(isMerchantComparable(row)){
    const specs=matched.get(row.merchant_slug)??new Set<string>();specs.add(row.spec_key);matched.set(row.merchant_slug,specs);
  }
  const result=new Map<string,{comparable_count:number;lowest_count:number;top_five_count:number}>();
  for(const [merchant,specs] of matched){let comparable_count=0,lowest_count=0,top_five_count=0;
    for(const spec of specs){const competitors=prices.get(spec);if(!competitors||competitors.size<2)continue;
      comparable_count++;const ordered=[...competitors.values()].sort((a,b)=>a-b);const value=competitors.get(merchant);
      if(value===undefined)continue;const rank=ordered.findIndex(price=>price===value)+1;if(rank===1)lowest_count++;if(rank<=5)top_five_count++;
    }result.set(merchant,{comparable_count,lowest_count,top_five_count});
  }return result;
}

function merchantRows(all: CatalogOffer[], filtered: CatalogOffer[]): ChannelRow[] {
  const scores=merchantScores(all,filtered),groups=new Map<string,CatalogOffer[]>();
  for(const row of filtered){const group=groups.get(row.merchant_slug)??[];group.push(row);groups.set(row.merchant_slug,group);}
  return [...groups.values()].map(rows=>{const row=rows[0]!,score=scores.get(row.merchant_slug)??{comparable_count:0,lowest_count:0,top_five_count:0};
    return {...row,id:row.merchant_slug,spec_key:"",merchant_host:minText(rows.map(item=>item.merchant_host)),
      merchant_platforms:[...new Set(rows.map(item=>item.platform))].sort(),merchant_products:[...new Set(rows.map(item=>item.product_name))].sort(),
      ...score,price:null,currency:"",offer_count:rows.length,available_count:rows.filter(item=>item.available).length,
      merchant_count:new Set(rows.map(item=>item.product_slug)).size,verified_at:maxDate(rows.map(item=>item.verified_at))};
  });
}

function compareRows(a: ChannelRow,b: ChannelRow,filters:ChannelFilters,view:string){
  if(filters.sort==="low_price"&&view==="merchants")return (b.lowest_count??0)-(a.lowest_count??0)||(b.top_five_count??0)-(a.top_five_count??0)||(b.comparable_count??0)-(a.comparable_count??0)||b.available_count-a.available_count||time(b.verified_at)-time(a.verified_at)||a.id.localeCompare(b.id);
  if(filters.sort==="price"&&view!=="merchants")return a.currency.localeCompare(b.currency)||(number(a.price)??Infinity)-(number(b.price)??Infinity)||time(b.verified_at)-time(a.verified_at)||a.id.localeCompare(b.id);
  if(filters.sort==="offers")return b.offer_count-a.offer_count||time(b.verified_at)-time(a.verified_at)||a.id.localeCompare(b.id);
  return time(b.verified_at)-time(a.verified_at)||b.available_count-a.available_count||a.id.localeCompare(b.id);
}

export function buildChannelCatalog(model: ChannelReadModel, filters: ChannelFilters): ChannelCatalog {
  const filtered=model.offers.filter(offer=>matches(offer,filters)),ranked=rankOffers(filtered),view=catalogView(filters);
  const rows=view==="products"?productRows(ranked):view==="merchants"?merchantRows(model.offers,filtered):ranked.map(row=>({...row,offer_count:1,available_count:Number(row.available),merchant_count:1}));
  rows.sort((a,b)=>compareRows(a,b,filters,view));
  const total=rows.length,page=Math.min(filters.page,Math.max(1,Math.ceil(total/filters.pageSize))),start=(page-1)*filters.pageSize;
  const specRow=filters.spec?model.offers.find(row=>row.spec_key===filters.spec):undefined;
  const spec:ChannelSpec|null=specRow?{product_slug:specRow.product_slug,product_name:specRow.product_name,platform:specRow.platform,
    offer_mode:specRow.offer_mode,duration_days:specRow.duration_days,region:specRow.region,account_ownership:specRow.account_ownership,
    warranty_type:specRow.warranty_type,warranty_hours:specRow.warranty_hours,currency:specRow.currency}:null;
  return {rows:rows.slice(start,start+filters.pageSize),total,page,pageSize:filters.pageSize,offerCount:filtered.length,
    merchantCount:new Set(filtered.map(row=>row.merchant_slug)).size,availableCount:filtered.filter(row=>row.available).length,
    latest:maxDate(filtered.map(row=>row.verified_at)),spec};
}
