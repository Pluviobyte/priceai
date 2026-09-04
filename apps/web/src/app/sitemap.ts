import type { MetadataRoute } from "next";
import { query } from "@/lib/database";
import { docsArticles } from "@/lib/docs-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const deploymentOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const base = process.env.PUBLIC_BASE_URL ?? (deploymentOrigin ? `https://${deploymentOrigin}` : "http://localhost:3000");
  let products: Array<{ slug: string; updated_at: Date }> = [];
  let merchants: Array<{ slug: string; updated_at: Date }> = [];

  try {
    [products, merchants] = await Promise.all([
      query<{ slug: string; updated_at: Date }>("select slug,updated_at from canonical_products where status='active'"),
      query<{ slug: string; updated_at: Date }>("select slug,updated_at from merchants where status='active'"),
    ]);
  } catch {
    // Static routes remain indexable when an optional deployment has no catalog database.
  }
  const staticPaths = ["", "/search", "/subscriptions", "/changes", "/channels", "/official-prices", "/official-api", "/api-transit", "/api-transit/models", "/api-transit/detector", "/methodology", "/status", "/submit", "/merchant-feed", "/guides", "/guides/why-ai-subscription-prices-differ", "/guides/ai-subscription-region-price-risks", "/guides/how-to-subscribe-ai-officially", "/guides/apple-id-ai-subscription", "/guides/google-play-ai-subscription", "/guides/visa-card-for-ai-subscription", "/guides/ai-subscription-gift-card", "/guides/are-ai-subscription-card-shops-reliable", "/guides/chatgpt-subscription-options", "/guides/api-transit", "/guides/self-host-api-transit", "/docs", ...docsArticles.map((article) => `/docs/${article.slug}`), "/commercial", "/support", "/wholesale"];
  return [...staticPaths.map((path) => ({ url: `${base}${path}`, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.7 })), ...products.map((item) => ({ url: `${base}/products/${item.slug}`, lastModified: item.updated_at, changeFrequency: "hourly" as const, priority: 0.9 })), ...merchants.map((item) => ({ url: `${base}/merchants/${item.slug}`, lastModified: item.updated_at, changeFrequency: "daily" as const, priority: 0.6 }))];
}
