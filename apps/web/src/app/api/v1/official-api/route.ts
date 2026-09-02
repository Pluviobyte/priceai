import { getOfficialApiPrices } from "@/lib/public-pricing";
import { publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ data: await getOfficialApiPrices(), generatedAt: new Date().toISOString() });
}
