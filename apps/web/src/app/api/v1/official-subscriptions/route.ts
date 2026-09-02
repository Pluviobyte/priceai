import { getOfficialSubscriptionPrices } from "@/lib/public-pricing";
import { paginated, parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ ...paginated(await getOfficialSubscriptionPrices(), parsePagination(request)), generatedAt: new Date().toISOString(), comparabilityRule: "exact_same_plan_same_period_only" });
}
