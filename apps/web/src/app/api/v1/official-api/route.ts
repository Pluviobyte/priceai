import { getOfficialApiPrices } from "@/lib/public-pricing";
import { paginated, parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ ...paginated(await getOfficialApiPrices(), parsePagination(request)), generatedAt: new Date().toISOString() });
}
