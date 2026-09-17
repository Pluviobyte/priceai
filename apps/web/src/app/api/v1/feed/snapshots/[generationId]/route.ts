import { buildGenerationFeed } from "@/lib/public-feed";
import { publicApiGuard } from "@/lib/public-api";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const { generationId } = await params;
  if (!UUID.test(generationId)) return Response.json({ error: "invalid_generation" }, { status: 400 });
  const feed = await buildGenerationFeed(generationId);
  if (!feed) return Response.json({ error: "generation_not_found" }, { status: 404 });
  if ('expired' in feed) return Response.json({ error: "generation_expired" }, { status: 410, headers: { "Cache-Control": "no-store" } });
  if ('incomplete' in feed) return Response.json({ error: "generation_snapshot_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const etag = `\"${feed.sha256}\"`;
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable", ETag: etag, "X-Content-Type-Options": "nosniff" };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(feed.body, { headers });
}
