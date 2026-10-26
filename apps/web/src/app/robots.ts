import type { MetadataRoute } from "next";

// Read the production origin at runtime, as the sitemap route does.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/", "/api/admin/", "/api/transit/check",
        // Buy-link redirects: a crawler following them inflates click counts and leaves the site.
        "/out/",
        "/account", "/login",
        // Filtered and paged views repeat the canonical pages listed in the sitemap.
        "/*?*group=", "/*?*sort=", "/*?*view=", "/*?*q=",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
