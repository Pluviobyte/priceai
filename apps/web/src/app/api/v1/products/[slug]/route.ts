import { getPublicProduct } from "@/lib/public-catalog";
import { publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const { slug } = await params;
  const product = await getPublicProduct(slug, { stock: "all" });
  if (!product) return Response.json({ error: "product_not_found" }, { status: 404 });
  return publicApiResponse({ data: product });
}
