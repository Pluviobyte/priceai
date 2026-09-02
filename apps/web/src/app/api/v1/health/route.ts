import { publicApiGuard, publicApiResponse } from "@/lib/public-api";
import { getPublicHealth } from "@/lib/public-platform";

export async function GET(request: Request) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  return publicApiResponse({ data: await getPublicHealth() });
}
