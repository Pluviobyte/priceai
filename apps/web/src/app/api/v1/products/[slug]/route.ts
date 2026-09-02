import { getPublicProduct } from "@/lib/public-catalog";
import { parsePagination, publicApiGuard, publicApiResponse } from "@/lib/public-api";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  const { slug } = await params;
  const product = await getPublicProduct(slug, { stock: "all" });
  if (!product) return Response.json({ error: "product_not_found" }, { status: 404 });
  const pagination = parsePagination(request);
  const offers = product.offers.slice(pagination.offset, pagination.offset + pagination.limit);
  return publicApiResponse({ data: { ...product, offers }, pagination: { page: pagination.page, limit: pagination.limit, total: product.offers.length, hasNext: pagination.offset + pagination.limit < product.offers.length } });
}
