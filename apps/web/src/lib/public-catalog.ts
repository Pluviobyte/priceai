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
            o.freshness_state,
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
