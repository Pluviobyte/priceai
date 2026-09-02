import { query } from "./database";

export interface PublicOffer {
  id: string;
  productSlug: string;
  productName: string;
  merchantName: string;
  price: string;
  currency: string;
  stockCount: number | null;
  stockState: string;
  freshnessState: string;
  offerMode: string;
  productUrl: string;
  riskFacts: string[];
  verifiedAt: Date | null;
}

export interface PublicProductSummary {
  slug: string;
  name: string;
  platform: string;
  offerCount: number;
  lowestPrice: string | null;
  currency: string | null;
  warrantyLowestPrice?: string | null;
}

export interface PublicOfferDetail extends PublicOffer {
  merchantSlug: string;
  sourceId: string;
  rawTitle: string;
  rawDescription: string | null;
  rawCategory: string | null;
  rawPriceText: string;
  sourceItemId: string;
  durationDays: number | null;
  warrantyType: string;
  warrantyHours: number | null;
  accountOwnership: string;
  phoneBound: boolean | null;
  shared: boolean | null;
  webAvailable: boolean | null;
  apiAvailable: boolean | null;
  autoDelivery: boolean | null;
  firstSeenAt: Date;
}

export interface PublicProductDetail {
  id: string;
  slug: string;
  name: string;
  brand: string;
  planFamily: string;
  billingPeriod: string | null;
  baseDurationDays: number | null;
  publishedAt: Date | null;
  offers: PublicOfferDetail[];
  history: Array<{
    offerId: string;
    merchantName: string;
    price: string;
    currency: string;
    stockState: string;
    stockCount: number | null;
    observedAt: Date;
  }>;
}

export interface OfferFilters {
  q?: string;
  mode?: string;
  warranty?: string;
  ownership?: string;
  stock?: "available" | "all";
  shared?: "yes" | "no";
  phoneBound?: "yes" | "no";
  durationDays?: number;
  sort?: "default" | "price" | "freshness";
}

export interface PublicMerchantDetail {
  id: string;
  slug: string;
  name: string;
  websiteUrl: string | null;
  commercialRelation: string;
  firstSeenAt: Date | null;
  lastSuccessAt: Date | null;
  healthStatus: string;
  collectorKind: string;
  offers: PublicOfferDetail[];
}

export interface PublicChannel {
  sourceId: string;
  merchantSlug: string;
  merchantName: string;
  websiteUrl: string;
  collectorKind: string;
  healthStatus: string;
  enabled: boolean;
  firstSeenAt: Date;
  lastSuccessAt: Date | null;
  expectedProductCount: number | null;
  lastCheckedAt: Date | null;
}

export interface PublicCatalog {
  generationId: string | null;
  publishedAt: Date | null;
  verifiedOfferCount: number;
  activeSourceCount: number;
  products: PublicProductSummary[];
  offers: PublicOffer[];
}

interface PublicationRow {
  generation_id: string;
  published_at: Date | null;
}

interface OfferRow {
  id: string;
  product_slug: string;
  product_name: string;
  merchant_name: string;
  source_id: string;
  price: string;
  currency: string;
  stock_count: number | null;
  stock_state: string;
  freshness_state: string;
  offer_mode: string;
  product_url: string;
  risk_facts: string[];
  verified_at: Date | null;
}

interface ProductSummaryRow {
  slug: string;
  name: string;
  platform: string;
  offer_count: string;
  lowest_price: string | null;
  warranty_lowest_price: string | null;
  currency: string | null;
}

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  brand: string;
  plan_family: string;
  billing_period: string | null;
  base_duration_days: number | null;
}

interface OfferDetailRow extends OfferRow {
  merchant_slug: string;
  raw_title: string;
  raw_description: string | null;
  raw_category: string | null;
  raw_price_text: string;
  source_item_id: string;
  duration_days: number | null;
  warranty_type: string;
  warranty_hours: number | null;
  account_ownership: string;
  phone_bound: boolean | null;
  shared: boolean | null;
  web_available: boolean | null;
  api_available: boolean | null;
  auto_delivery: boolean | null;
  first_seen_at: Date;
}

interface HistoryRow {
  offer_id: string;
  merchant_name: string;
  price: string;
  currency: string;
  stock_state: string;
  stock_count: number | null;
  observed_at: Date;
}

interface MerchantRow {
  id: string;
  slug: string;
  name: string;
  website_url: string | null;
  commercial_relation: string;
  first_seen_at: Date | null;
  last_success_at: Date | null;
  health_status: string;
  collector_kind: string;
}

interface ChannelRow {
  source_id: string;
  merchant_slug: string;
  merchant_name: string;
  website_url: string;
  collector_kind: string;
  health_status: string;
  enabled: boolean;
  first_seen_at: Date;
  last_success_at: Date | null;
  expected_product_count: number | null;
  last_checked_at: Date | null;
}

const FEATURED_PRODUCTS = [
  { slug: "chatgpt-plus", name: "ChatGPT Plus", platform: "OpenAI" },
  { slug: "claude-pro", name: "Claude Pro", platform: "Anthropic" },
  { slug: "gemini-pro", name: "Google AI Pro", platform: "Google" },
  { slug: "supergrok", name: "SuperGrok", platform: "xAI" },
] as const;

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const [publication] = await query<PublicationRow>(
    `select pc.current_generation_id as generation_id, pg.published_at
       from publication_channels pc
       join publish_generations pg on pg.id = pc.current_generation_id
      where pc.channel = $1
      limit 1`,
    ["card_prices"],
  );

  if (!publication?.generation_id) {
    return {
      generationId: null,
      publishedAt: null,
      verifiedOfferCount: 0,
      activeSourceCount: 0,
      products: FEATURED_PRODUCTS.map((product) => ({
        ...product,
        offerCount: 0,
        lowestPrice: null,
        currency: null,
      })),
      offers: [],
    };
  }

  const rows = await query<OfferRow>(
    `select o.id,
            cp.slug as product_slug,
            cp.display_name as product_name,
            m.name as merchant_name,
            s.id as source_id,
            o.price,
            o.currency,
            o.stock_count,
            o.stock_state,
            case when o.offer_verified_at>now()-interval '6 hours' then 'fresh'
                 when o.offer_verified_at>now()-interval '24 hours' then 'aging' else 'stale' end freshness_state,
            o.offer_mode,
            o.product_url,
            o.risk_facts,
            o.offer_verified_at as verified_at
       from offers o
       join canonical_products cp on cp.id = o.canonical_product_id
       join sources s on s.id = o.source_id
       join merchants m on m.id = s.merchant_id
      where o.publish_generation_id = $1
        and o.availability_state = 'purchasable'
        and o.offer_verified_at > now()-interval '24 hours'
      order by o.price asc`,
    [publication.generation_id],
  );

  const productRows = new Map<string, OfferRow[]>();
  for (const row of rows) {
    const group = productRows.get(row.product_slug) ?? [];
    group.push(row);
    productRows.set(row.product_slug, group);
  }

  const products = FEATURED_PRODUCTS.map((product) => {
    const productOffers = productRows.get(product.slug) ?? [];
    const lowest = productOffers[0];
    return {
      ...product,
      offerCount: productOffers.length,
      lowestPrice: lowest?.price ?? null,
      currency: lowest?.currency ?? null,
    };
  });

  return {
    generationId: publication.generation_id,
    publishedAt: publication.published_at,
    verifiedOfferCount: rows.length,
    activeSourceCount: new Set(rows.map((row) => row.source_id)).size,
    products,
    offers: rows.slice(0, 12).map((row) => ({
      id: row.id,
      productSlug: row.product_slug,
      productName: row.product_name,
      merchantName: row.merchant_name,
      price: row.price,
      currency: row.currency,
      stockCount: row.stock_count,
      stockState: row.stock_state,
      freshnessState: row.freshness_state,
      offerMode: row.offer_mode,
      productUrl: row.product_url,
      riskFacts: row.risk_facts,
      verifiedAt: row.verified_at,
    })),
  };
}

async function getCurrentPublication(): Promise<PublicationRow | null> {
  const [publication] = await query<PublicationRow>(
    `select pc.current_generation_id as generation_id,pg.published_at
       from publication_channels pc
       join publish_generations pg on pg.id=pc.current_generation_id
      where pc.channel='card_prices' limit 1`,
  );
  return publication ?? null;
}

function mapOfferDetail(row: OfferDetailRow): PublicOfferDetail {
  return {
    id: row.id,
    productSlug: row.product_slug,
    productName: row.product_name,
    merchantName: row.merchant_name,
    merchantSlug: row.merchant_slug,
    sourceId: row.source_id,
    price: row.price,
    currency: row.currency,
    stockCount: row.stock_count,
    stockState: row.stock_state,
    freshnessState: row.freshness_state,
    offerMode: row.offer_mode,
    productUrl: row.product_url,
    riskFacts: row.risk_facts,
    verifiedAt: row.verified_at,
    rawTitle: row.raw_title,
    rawDescription: row.raw_description,
    rawCategory: row.raw_category,
    rawPriceText: row.raw_price_text,
    sourceItemId: row.source_item_id,
    durationDays: row.duration_days,
    warrantyType: row.warranty_type,
    warrantyHours: row.warranty_hours,
    accountOwnership: row.account_ownership,
    phoneBound: row.phone_bound,
    shared: row.shared,
    webAvailable: row.web_available,
    apiAvailable: row.api_available,
    autoDelivery: row.auto_delivery,
    firstSeenAt: row.first_seen_at,
  };
}

function offerDetailSelect(): string {
  return `select o.id,cp.slug product_slug,cp.display_name product_name,
                 m.name merchant_name,m.slug merchant_slug,s.id source_id,
                 o.price,o.currency,o.stock_count,o.stock_state,
                 case when o.offer_verified_at>now()-interval '6 hours' then 'fresh'
                      when o.offer_verified_at>now()-interval '24 hours' then 'aging' else 'stale' end freshness_state,
                 o.offer_mode,o.product_url,o.risk_facts,o.offer_verified_at verified_at,
                 o.first_seen_at,ros.raw_title,ros.raw_description,ros.raw_category,
                 ros.raw_price_text,o.source_item_id,oa.duration_days,oa.warranty_type,
                 oa.warranty_hours,oa.account_ownership,oa.phone_bound,oa.shared,
                 oa.web_available,oa.api_available,oa.auto_delivery
            from offers o
            join canonical_products cp on cp.id=o.canonical_product_id
            join sources s on s.id=o.source_id
            join merchants m on m.id=s.merchant_id
            join raw_offer_snapshots ros on ros.id=o.latest_raw_snapshot_id
            join offer_matches om on om.raw_offer_snapshot_id=ros.id
            left join offer_attributes oa on oa.offer_match_id=om.id`;
}

function filterOfferSql(
  filters: OfferFilters,
  values: unknown[],
): { conditions: string[]; orderBy: string } {
  const conditions = ["o.availability_state <> 'quarantined'"];
  const push = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };
  if (filters.q) {
    const escaped = filters.q.replace(/[\\%_]/g, "\\$&");
    const parameter = push(`%${escaped}%`);
    conditions.push(`(ros.raw_title ilike ${parameter} escape '\\' or m.name ilike ${parameter} escape '\\')`);
  }
  if (filters.mode) conditions.push(`o.offer_mode=${push(filters.mode)}`);
  if (filters.warranty) conditions.push(`oa.warranty_type=${push(filters.warranty)}`);
  if (filters.ownership) conditions.push(`oa.account_ownership=${push(filters.ownership)}`);
  if (filters.stock !== "all") {
    conditions.push("o.availability_state='purchasable'");
    conditions.push("o.offer_verified_at>now()-interval '24 hours'");
    conditions.push("o.stock_state in ('in_stock','low_stock','unknown')");
  }
  if (filters.shared === "yes") conditions.push("oa.shared=true");
  if (filters.shared === "no") conditions.push("coalesce(oa.shared,false)=false");
  if (filters.phoneBound === "yes") conditions.push("oa.phone_bound=true");
  if (filters.phoneBound === "no") conditions.push("oa.phone_bound=false");
  if (filters.durationDays) conditions.push(`oa.duration_days=${push(filters.durationDays)}`);
  const orderBy = filters.sort === "price"
    ? "o.price asc,o.offer_verified_at desc nulls last"
    : filters.sort === "freshness"
      ? "o.offer_verified_at desc nulls last,o.price asc"
      : `case o.availability_state when 'purchasable' then 1 when 'unavailable' then 2 else 3 end,
         case when o.offer_verified_at>now()-interval '6 hours' then 1 when o.offer_verified_at>now()-interval '24 hours' then 2 else 3 end,
         case when o.offer_mode in ('recharge','finished_account','redeem_code','team_seat') then 1 else 2 end,
         o.price asc`;
  return { conditions, orderBy };
}

export async function getProductSummaries(brand?: string): Promise<PublicProductSummary[]> {
  const publication = await getCurrentPublication();
  const values: unknown[] = [publication?.generation_id ?? null];
  const brandCondition = brand ? `and lower(cp.brand)=lower($${values.push(brand)})` : "";
  const rows = await query<ProductSummaryRow>(
    `select cp.slug,cp.display_name name,cp.brand platform,
            count(o.id) filter (where o.availability_state='purchasable' and o.offer_verified_at>now()-interval '24 hours')::text offer_count,
            min(o.price) filter (where o.availability_state='purchasable' and o.offer_verified_at>now()-interval '24 hours') lowest_price,
            min(o.price) filter (where o.availability_state='purchasable' and o.offer_verified_at>now()-interval '24 hours' and oa.warranty_type not in ('none','unknown')) warranty_lowest_price,
            min(o.currency) filter (where o.availability_state='purchasable' and o.offer_verified_at>now()-interval '24 hours') currency
       from canonical_products cp
       left join offers o on o.canonical_product_id=cp.id and o.publish_generation_id=$1
       left join raw_offer_snapshots ros on ros.id=o.latest_raw_snapshot_id
       left join offer_matches om on om.raw_offer_snapshot_id=ros.id
       left join offer_attributes oa on oa.offer_match_id=om.id
      where cp.status='active' ${brandCondition}
      group by cp.id order by cp.brand,cp.display_name`,
    values,
  );
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    platform: row.platform,
    offerCount: Number(row.offer_count),
    lowestPrice: row.lowest_price,
    warrantyLowestPrice: row.warranty_lowest_price,
    currency: row.currency,
  }));
}

export async function getPublicProduct(
  slug: string,
  filters: OfferFilters = {},
): Promise<PublicProductDetail | null> {
  const publication = await getCurrentPublication();
  const [product] = await query<ProductRow>(
    `select id,slug,display_name name,brand,plan_family,billing_period,base_duration_days
       from canonical_products where slug=$1 and status='active' limit 1`,
    [slug],
  );
  if (!product) return null;
  const values: unknown[] = [publication?.generation_id ?? null, product.id];
  const filtered = filterOfferSql(filters, values);
  const offerRows = await query<OfferDetailRow>(
    `${offerDetailSelect()}
      where o.publish_generation_id=$1 and o.canonical_product_id=$2
        and ${filtered.conditions.join(" and ")}
      order by ${filtered.orderBy} limit 300`,
    values,
  );
  const historyRows = await query<HistoryRow>(
    `select oph.offer_id,m.name merchant_name,oph.price,oph.currency,
            oph.stock_state,oph.stock_count,oph.observed_at
       from offer_price_history oph
       join offers o on o.id=oph.offer_id
       join sources s on s.id=o.source_id
       join merchants m on m.id=s.merchant_id
      where o.canonical_product_id=$1
      order by oph.observed_at desc limit 240`,
    [product.id],
  );
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    planFamily: product.plan_family,
    billingPeriod: product.billing_period,
    baseDurationDays: product.base_duration_days,
    publishedAt: publication?.published_at ?? null,
    offers: offerRows.map(mapOfferDetail),
    history: historyRows.map((row) => ({
      offerId: row.offer_id,
      merchantName: row.merchant_name,
      price: row.price,
      currency: row.currency,
      stockState: row.stock_state,
      stockCount: row.stock_count,
      observedAt: row.observed_at,
    })),
  };
}

export async function searchPublicOffers(
  search: string,
  filters: OfferFilters = {},
): Promise<PublicOfferDetail[]> {
  const publication = await getCurrentPublication();
  if (!publication || !search.trim()) return [];
  const values: unknown[] = [publication.generation_id];
  const escaped = search.trim().replace(/[\\%_]/g, "\\$&");
  values.push(`%${escaped}%`);
  const searchCondition = `(cp.display_name ilike $2 escape '\\' or cp.brand ilike $2 escape '\\' or ros.raw_title ilike $2 escape '\\' or m.name ilike $2 escape '\\')`;
  const { q: _query, ...secondaryFilters } = filters;
  const filtered = filterOfferSql(secondaryFilters, values);
  const rows = await query<OfferDetailRow>(
    `${offerDetailSelect()}
      where o.publish_generation_id=$1 and ${searchCondition}
        and ${filtered.conditions.join(" and ")}
      order by ${filtered.orderBy} limit 150`,
    values,
  );
  return rows.map(mapOfferDetail);
}

export async function getPublicMerchant(slug: string): Promise<PublicMerchantDetail | null> {
  const publication = await getCurrentPublication();
  const [merchant] = await query<MerchantRow>(
    `select m.id,m.slug,m.name,m.website_url,m.commercial_relation,
            min(s.first_seen_at) first_seen_at,max(s.last_success_at) last_success_at,
            min(s.health_status::text) health_status,min(s.collector_kind) collector_kind
       from merchants m join sources s on s.merchant_id=m.id
      where m.slug=$1 and m.status='active'
      group by m.id limit 1`,
    [slug],
  );
  if (!merchant) return null;
  const rows = publication ? await query<OfferDetailRow>(
    `${offerDetailSelect()}
      where o.publish_generation_id=$1 and m.id=$2 and o.availability_state <> 'quarantined'
      order by case o.availability_state when 'purchasable' then 1 else 2 end,o.price asc limit 300`,
    [publication.generation_id, merchant.id],
  ) : [];
  return {
    id: merchant.id,
    slug: merchant.slug,
    name: merchant.name,
    websiteUrl: merchant.website_url,
    commercialRelation: merchant.commercial_relation,
    firstSeenAt: merchant.first_seen_at,
    lastSuccessAt: merchant.last_success_at,
    healthStatus: merchant.health_status,
    collectorKind: merchant.collector_kind,
    offers: rows.map(mapOfferDetail),
  };
}

export async function getPublicChannels(): Promise<PublicChannel[]> {
  const rows = await query<ChannelRow>(
    `select s.id source_id,m.slug merchant_slug,m.name merchant_name,
            s.canonical_entry_url website_url,s.collector_kind,s.health_status,
            s.enabled,s.first_seen_at,s.last_success_at,s.expected_product_count,s.last_checked_at
       from sources s join merchants m on m.id=s.merchant_id
      where s.health_status <> 'removed'
      order by s.enabled desc,s.health_status,m.name`,
  );
  return rows.map((row) => ({
    sourceId: row.source_id,
    merchantSlug: row.merchant_slug,
    merchantName: row.merchant_name,
    websiteUrl: row.website_url,
    collectorKind: row.collector_kind,
    healthStatus: row.health_status,
    enabled: row.enabled,
    firstSeenAt: row.first_seen_at,
    lastSuccessAt: row.last_success_at,
    expectedProductCount: row.expected_product_count,
    lastCheckedAt: row.last_checked_at,
  }));
}
