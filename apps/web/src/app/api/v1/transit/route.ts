import { getTransitOverview } from "@/lib/public-pricing";
import { publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ data: await getTransitOverview(), generatedAt: new Date().toISOString(), evidenceKinds: ["provider_self_reported", "public_monitor", "platform_probe"] });
}
