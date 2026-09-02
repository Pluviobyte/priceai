import { getTransitOverview } from "@/lib/public-pricing";
import { parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const data = await getTransitOverview();
  const pagination = parsePagination(request, 100);
  const prices = data.prices.slice(pagination.offset, pagination.offset + pagination.limit);
  return publicApiResponse({ data: { ...data, prices }, pagination: { page: pagination.page, limit: pagination.limit, total: data.prices.length, hasNext: pagination.offset + pagination.limit < data.prices.length }, generatedAt: new Date().toISOString(), evidenceKinds: ["provider_self_reported", "public_monitor", "platform_probe"] });
}
