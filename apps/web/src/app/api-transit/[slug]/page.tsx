import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTransitOverview, getTransitPrices } from "@/lib/public-pricing";
import { SiteFooter } from "../../site-footer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} 中转 API | PriceAI` };
}

export default async function TransitDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "models" || slug === "detector") notFound();
  const data = await getTransitOverview({ includePrices: false });
  const provider = data.providers.find((item) => item.slug === slug);
  if (!provider) notFound();
  const { prices } = await getTransitPrices({ provider: slug });
  return <div className="priceai-page"><main className="priceai-detail-shell"><Link className="priceai-detail-back" href="/api-transit">← 返回中转榜</Link><section className="priceai-detail-hero"><div><span>中转 API 站点</span><h1>{provider.displayName}</h1><p>{provider.operatorName ?? "运营主体未公开"} · {provider.systemKind.replaceAll("_", " ")}。价格、可用性和来源资料仅供购买前比较。</p></div><dl><div><dt>模型</dt><dd>{provider.modelCount}</dd></div><div><dt>7 日样本</dt><dd>{provider.sampleCount7d}</dd></div><div><dt>成功率</dt><dd>{provider.successRate7d === null ? "—" : `${(provider.successRate7d * 100).toFixed(1)}%`}</dd></div></dl></section><nav className="priceai-detail-links"><a href={provider.websiteUrl}>访问官网　↗</a><a href={provider.evidenceUrl}>查看来源　↗</a>{provider.statusUrl && <a href={provider.statusUrl}>公开状态页　↗</a>}</nav><div className="priceai-detail-table-wrap"><table><thead><tr><th>模型</th><th>模型 ID</th><th>输入</th><th>输出</th><th>倍率</th><th>公开证据</th></tr></thead><tbody>{prices.map((price) => <tr key={`${price.providerSlug}:${price.modelCode}`}><td><b>{price.displayName}</b></td><td><small>{price.modelCode}</small></td><td><strong>{price.inputPrice ? `$${Number(price.inputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</strong></td><td><strong>{price.outputPrice ? `$${Number(price.outputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</strong></td><td><em>{price.multiplier ? `${Number(price.multiplier).toLocaleString("en-US", { maximumFractionDigits: 4 })}x` : "未披露"}</em></td><td><a href={price.evidenceUrl}>公开目录　↗</a></td></tr>)}</tbody></table></div><p><Link href={`/api-transit/models?provider=${encodeURIComponent(slug)}`}>查看全部 {provider.modelCount} 条报价及分页 →</Link></p></main><SiteFooter /></div>;
}
