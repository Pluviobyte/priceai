import { robotsText } from "@/lib/robots";

// Read the production origin at runtime, as the sitemap route does.
export const dynamic = "force-dynamic";

export function GET(): Response {
  const base = process.env.PUBLIC_BASE_URL ?? "http://localhost:3000";
  return new Response(robotsText(base), { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
