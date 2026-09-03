import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfficialApiPrices } from "@/lib/public-pricing";
import { SiteHeader } from "../../../site-header";
import { SiteFooter } from "../../../site-footer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} 官方 API | PriceAI` };
}

export default async function ApiProviderPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const rows = (await getOfficialApiPrices()).filter((row) => row.vendor.toLowerCase() === slug.toLowerCase());
  if (!rows.length) notFound();
  const vendor = rows[0]!.vendor;
  return <div className="priceai-page"><SiteHeader active="api" /><main className="priceai-detail-shell"><Link className="priceai-detail-back" href="/official-api">← 返回官方 API</Link><section className="priceai-detail-hero"><div><span>官方 API 来源渠道</span><h1>{vendor} 官方 API</h1><p>拆开查看输入、缓存输入、输出和不同价格层级；具体上下文、速率限制与可用地区以厂商文档为准。</p></div><dl><div><dt>报价</dt><dd>{rows.length}</dd></div><div><dt>模型</dt><dd>{new Set(rows.map((row) => row.modelCode)).size}</dd></div><div><dt>计价层级</dt><dd>{new Set(rows.map((row) => row.priceTier)).size}</dd></div></dl></section><div className="priceai-detail-table-wrap"><table><thead><tr><th>模型</th><th>层级</th><th>输入</th><th>缓存输入</th><th>输出</th><th>证据</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.modelName}</b><small>{row.modelCode}</small></td><td><em>{row.priceTier}</em><small>{row.unit.replaceAll("_", " ")}</small></td><td><strong>{row.inputPrice ? `$${Number(row.inputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</strong></td><td>{row.cachedInputPrice ? `$${Number(row.cachedInputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</td><td><strong>{row.outputPrice ? `$${Number(row.outputPrice).toLocaleString("en-US", { maximumFractionDigits: 8 })}` : "—"}</strong></td><td><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">官方文档　↗</a></td></tr>)}</tbody></table></div></main><SiteFooter /></div>;
}
