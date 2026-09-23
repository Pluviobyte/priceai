import type { Metadata } from "next";
import Link from "next/link";
import { getTransitOverview, getTransitPrices } from "@/lib/public-pricing";
import { SiteFooter } from "../../site-footer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "中转 API 模型价格 | PriceAI" };

export default async function TransitModelsPage({ searchParams }: { searchParams: Promise<{ provider?: string; page?: string }> }) {
  const params = await searchParams;
  const provider = typeof params.provider === "string" ? params.provider : "";
  const data = await getTransitOverview({ includePrices: false });
  const result = await getTransitPrices({ provider, page: Number(params.page) });
  const pageLink = (page: number) => `/api-transit/models?${new URLSearchParams({ provider, page: String(page) })}`;
  return <div className="priceai-page"><main className="priceai-detail-shell"><Link className="priceai-detail-back" href="/api-transit">← 返回站点榜</Link><section className="priceai-detail-hero"><div><span>中转 API</span><h1>公开模型价格</h1><p>按站点和模型查看公开输入价、输出价与倍率。这里只展示已发布的公开数据。</p></div><dl><div><dt>模型报价</dt><dd>{result.pagination.total}</dd></div><div><dt>站点</dt><dd>{data.providers.length}</dd></div></dl></section><form action="/api-transit/models"><label htmlFor="transit-provider">平台 </label><select id="transit-provider" name="provider" defaultValue={provider}><option value="">全部平台</option>{data.providers.map(item => <option key={item.slug} value={item.slug}>{item.displayName}（{item.modelCount}）</option>)}</select><button type="submit">查看</button></form><div className="priceai-detail-table-wrap"><table><thead><tr><th>站点</th><th>模型</th><th>输入</th><th>输出</th><th>倍率</th><th>来源</th></tr></thead><tbody>{result.prices.map((price) => <tr key={`${price.providerSlug}:${price.modelCode}`}><td><Link href={`/api-transit/${price.providerSlug}`}><b>{price.providerName}</b></Link></td><td><b>{price.displayName}</b><small>{price.modelCode}</small></td><td>{price.inputPrice ? `$${Number(price.inputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</td><td>{price.outputPrice ? `$${Number(price.outputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</td><td><em>{price.multiplier ? `${price.multiplier}x` : "未披露"}</em></td><td><a href={price.evidenceUrl}>公开目录　↗</a></td></tr>)}</tbody></table></div><nav aria-label="模型报价分页">{result.pagination.page > 1 && <Link href={pageLink(result.pagination.page - 1)}>上一页</Link>}<span> 第 {result.pagination.page} 页 · 共 {result.pagination.total} 条 </span>{result.pagination.hasNext && <Link href={pageLink(result.pagination.page + 1)}>下一页</Link>}</nav></main><SiteFooter /></div>;
}
