import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOfficialSubscriptionPrices } from "@/lib/public-pricing";
import { SiteHeader } from "../../site-header";
import { SiteFooter } from "../../site-footer";

export const dynamic = "force-dynamic";

const vendorMap: Record<string, string> = { chatgpt: "openai", claude: "anthropic", gemini: "google", grok: "xai" };
const channelNames: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const countryNames: Record<string, string> = { US: "美国", BO: "玻利维亚", PH: "菲律宾", EG: "埃及", PK: "巴基斯坦", JP: "日本", TR: "土耳其", IN: "印度", ID: "印度尼西亚", BR: "巴西", CL: "智利" };

function normalize(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-"); }

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${decodeURIComponent(slug).replace("__", " ")} 地区价 | PriceAI` };
}

export default async function OfficialPriceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [vendorAlias, planSlug] = decodeURIComponent(slug).split("__");
  const rows = (await getOfficialSubscriptionPrices()).filter((row) => row.vendor.toLowerCase() === (vendorMap[vendorAlias ?? ""] ?? vendorAlias) && normalize(row.planCode) === planSlug);
  if (!rows.length) notFound();
  const sample = rows[0]!;
  const sorted = [...rows].sort((a, b) => Number(a.cnyEstimate ?? Infinity) - Number(b.cnyEstimate ?? Infinity));
  return <div className="priceai-page"><SiteHeader active="official" /><main className="priceai-detail-shell"><Link className="priceai-detail-back" href="/official-prices">← 返回官方订阅</Link><section className="priceai-detail-hero"><div><span>官方订阅地区价</span><h1>{sample.planName}</h1><p>按渠道和地区列出公开标价、人民币估算与证据链接。实际结算可能叠加税费、支付手续费和汇率差异。</p></div><dl><div><dt>地区报价</dt><dd>{rows.length}</dd></div><div><dt>渠道</dt><dd>{new Set(rows.map((row) => row.channel)).size}</dd></div><div><dt>周期</dt><dd>{sample.billingPeriod === "month" ? "月付" : "年付"}</dd></div></dl></section><div className="priceai-detail-table-wrap"><table><thead><tr><th>地区</th><th>渠道</th><th>原币价格</th><th>人民币估算</th><th>价格精度</th><th>官方证据</th></tr></thead><tbody>{sorted.map((row) => <tr key={row.id}><td><b>{countryNames[row.countryCode] ?? row.countryCode}</b><small>{row.countryCode}</small></td><td>{channelNames[row.channel] ?? row.channel}</td><td>{row.amount ? `${row.currency} ${Number(row.amount).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}` : "未公开精确价"}</td><td><strong>{row.cnyEstimate ? `¥${Number(row.cnyEstimate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</strong></td><td><em>{row.priceKind === "exact" ? "精确价" : row.priceKind === "range" ? "区间价" : "未知"}</em></td><td><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">查看官方来源　↗</a></td></tr>)}</tbody></table></div></main><SiteFooter /></div>;
}
