import type { MetadataRoute } from "next";

// Read the production origin at runtime, as the sitemap route does.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/admin/", "/api/transit/check"] }, sitemap: `${base}/sitemap.xml` };
}
