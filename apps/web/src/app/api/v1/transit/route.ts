import { getTransitOverview, getTransitPrices } from "@/lib/public-pricing";
import { parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const data = await getTransitOverview({ includePrices: false });
  const pagination = parsePagination(request, 100);
  const { prices, pagination: resultPagination } = await getTransitPrices({ ...pagination, provider: new URL(request.url).searchParams.get("provider") ?? "" });
  return publicApiResponse({ data: { ...data, prices }, pagination: resultPagination, generatedAt: new Date().toISOString(), evidenceKinds: ["provider_self_reported", "public_monitor", "platform_probe"] });
}
