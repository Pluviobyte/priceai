import { getProductSummaries } from "@/lib/public-catalog";
import { publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const brand = new URL(request.url).searchParams.get("brand") ?? undefined;
  return publicApiResponse({ data: await getProductSummaries(brand), generatedAt: new Date().toISOString() });
}
