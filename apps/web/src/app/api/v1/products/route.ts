import { getProductSummaries } from "@/lib/public-catalog";
import { paginated, parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const brand = new URL(request.url).searchParams.get("brand") ?? undefined;
  const result = paginated(await getProductSummaries(brand), parsePagination(request));
  return publicApiResponse({ ...result, generatedAt: new Date().toISOString() });
}
