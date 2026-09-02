import { getPublicChannels } from "@/lib/public-catalog";
import { paginated, parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ ...paginated(await getPublicChannels(), parsePagination(request)), generatedAt: new Date().toISOString() });
}
