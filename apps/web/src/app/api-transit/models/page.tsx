import type { Metadata } from "next";
import Link from "next/link";
import { getTransitOverview } from "@/lib/public-pricing";
import { SiteFooter } from "../../site-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "中转 API 模型价格 | PriceAI" };

export default async function TransitModelsPage() {
  const data = await getTransitOverview();
  return <div className="priceai-page"><main className="priceai-detail-shell"><Link className="priceai-detail-back" href="/api-transit">← 返回站点榜</Link><section className="priceai-detail-hero"><div><span>中转 API</span><h1>公开模型价格</h1><p>按站点和模型查看公开输入价、输出价与倍率。这里只展示已发布的公开数据。</p></div><dl><div><dt>模型报价</dt><dd>{data.prices.length}</dd></div><div><dt>站点</dt><dd>{data.providers.length}</dd></div></dl></section><div className="priceai-detail-table-wrap"><table><thead><tr><th>站点</th><th>模型</th><th>输入</th><th>输出</th><th>倍率</th><th>来源</th></tr></thead><tbody>{data.prices.map((price) => <tr key={`${price.providerSlug}:${price.modelCode}`}><td><Link href={`/api-transit/${price.providerSlug}`}><b>{price.providerName}</b></Link></td><td><b>{price.displayName}</b><small>{price.modelCode}</small></td><td>{price.inputPrice ? `$${Number(price.inputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</td><td>{price.outputPrice ? `$${Number(price.outputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</td><td><em>{price.multiplier ? `${price.multiplier}x` : "未披露"}</em></td><td><a href={price.evidenceUrl}>公开目录　↗</a></td></tr>)}</tbody></table></div></main><SiteFooter /></div>;
}
