import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return { rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/admin/", "/api/transit/check"] }, sitemap: `${base}/sitemap.xml` };
}
