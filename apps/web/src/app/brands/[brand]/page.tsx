import { getProductSummaries } from "@/lib/public-catalog";
import { SiteHeader } from "../../site-header";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ brand: string }> }): Promise<Metadata> {
  const { brand } = await params;
  const label = decodeURIComponent(brand);
  return { title: `${label} AI 订阅比价 | AI 价格雷达`, description: `浏览 ${label} 的标准 AI 订阅产品和可核验报价。`, alternates: { canonical: `/brands/${encodeURIComponent(brand)}` } };
}

export default async function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  const products = await getProductSummaries(decodeURIComponent(brand));
  const label = products[0]?.platform ?? brand;
  return <main><SiteHeader active="subscriptions" /><section className="listing-shell"><span className="section-kicker">平台分类</span><h1>{label}</h1><p className="listing-lead">按标准权益产品浏览，不把交付方式不同的商品混为同一个最低价。</p><div className="catalog-grid">{products.map((product) => <a className="catalog-card" href={`/products/${product.slug}`} key={product.slug}><span>{product.platform}</span><h2>{product.name}</h2><dl><div><dt>有效报价</dt><dd>{product.offerCount}</dd></div><div><dt>最低价</dt><dd>{product.lowestPrice ? `¥${Number(product.lowestPrice).toFixed(2)}` : "—"}</dd></div><div><dt>有质保最低</dt><dd>{product.warrantyLowestPrice ? `¥${Number(product.warrantyLowestPrice).toFixed(2)}` : "—"}</dd></div></dl></a>)}</div></section></main>;
}
