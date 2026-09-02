import { getPublicChannels } from "@/lib/public-catalog";
import { publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ data: await getPublicChannels(), generatedAt: new Date().toISOString() });
}
