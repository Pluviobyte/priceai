import { getLatestFeedPointer } from "@/lib/public-feed";
import { publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const pointer = await getLatestFeedPointer();
  return pointer ? publicApiResponse(pointer) : Response.json({ error: "feed_not_published" }, { status: 404 });
}
