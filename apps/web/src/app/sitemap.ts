import type { MetadataRoute } from "next";
import { query } from "@/lib/database";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  const products = await query<{ slug: string; updated_at: Date }>("select slug,updated_at from canonical_products where status='active'");
  const merchants = await query<{ slug: string; updated_at: Date }>("select slug,updated_at from merchants where status='active'");
  const staticPaths = ["", "/search", "/subscriptions", "/changes", "/channels", "/official-prices", "/official-api", "/api-transit", "/methodology", "/status", "/submit", "/merchant-feed"];
  return [...staticPaths.map((path) => ({ url: `${base}${path}`, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.7 })), ...products.map((item) => ({ url: `${base}/products/${item.slug}`, lastModified: item.updated_at, changeFrequency: "hourly" as const, priority: 0.9 })), ...merchants.map((item) => ({ url: `${base}/merchants/${item.slug}`, lastModified: item.updated_at, changeFrequency: "daily" as const, priority: 0.6 }))];
}
