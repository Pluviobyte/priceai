import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OFFICIAL_SUBSCRIPTION_PLAN_CATALOG } from "@price-radar/price-channels/subscription-catalog";
import { getOfficialSubscriptionPrices, type OfficialSubscriptionPrice } from "@/lib/public-pricing";
import { SiteFooter } from "../../site-footer";
import { SiteHeader } from "../../site-header";

export const dynamic = "force-dynamic";

const vendorMap: Record<string, string> = { chatgpt: "openai", claude: "anthropic", gemini: "google", grok: "xai" };
const companyNames: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google", xai: "xAI" };
const channelNames: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const periodNames: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
const countryNames: Record<string, string> = {
  AR: "阿根廷", AU: "澳大利亚", BO: "玻利维亚", BR: "巴西", CA: "加拿大", CL: "智利", CN: "中国大陆",
  CO: "哥伦比亚", EG: "埃及", GB: "英国", HK: "中国香港", ID: "印度尼西亚", IN: "印度", JP: "日本",
  KR: "韩国", MX: "墨西哥", MY: "马来西亚", NG: "尼日利亚", NZ: "新西兰", PH: "菲律宾", PK: "巴基斯坦",
  SG: "新加坡", TH: "泰国", TR: "土耳其", TW: "中国台湾", US: "美国", VN: "越南", ZA: "南非",
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function resolveSlug(slug: string) {
  const [vendorAlias, planSlug] = decodeURIComponent(slug).split("__");
  const vendor = vendorMap[vendorAlias ?? ""] ?? vendorAlias ?? "";
  return { vendor, planSlug: planSlug ?? "" };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { vendor, planSlug } = resolveSlug(slug);
  const plan = OFFICIAL_SUBSCRIPTION_PLAN_CATALOG.find((item) => item.vendor === vendor && normalize(item.planCode) === planSlug);
  return {
    title: plan ? `${plan.displayName} 官方订阅地区价 | PriceAI` : "官方订阅地区价 | PriceAI",
    description: plan ? `查看 ${plan.displayName} 的官方订阅渠道、地区价格和证据链接。` : "查看 AI 官方订阅渠道、地区价格和证据链接。",
  };
}

export default async function OfficialPriceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { vendor, planSlug } = resolveSlug(slug);
  const catalogPlan = OFFICIAL_SUBSCRIPTION_PLAN_CATALOG.find((item) => item.vendor === vendor && normalize(item.planCode) === planSlug);

  let databaseAvailable = true;
  let allRows: OfficialSubscriptionPrice[] = [];
  try {
    allRows = await getOfficialSubscriptionPrices();
  } catch {
    databaseAvailable = false;
  }
  const rows = allRows.filter((row) => row.vendor.toLowerCase() === vendor && normalize(row.planCode) === planSlug);
  if (!rows.length && !catalogPlan) notFound();

  const sample = rows[0];
  const planName = sample?.planName ?? catalogPlan!.displayName;
  const billingPeriod = sample?.billingPeriod ?? catalogPlan!.billingPeriod;
  const officialUrl = catalogPlan?.officialUrl ?? sample!.evidenceUrl;
  const sorted = [...rows].sort((a, b) => Number(a.cnyEstimate ?? Infinity) - Number(b.cnyEstimate ?? Infinity));

  return <div className="priceai-page priceai-official-detail-page">
    <SiteHeader active="official" />
    <main className="priceai-detail-shell">
      <Link className="priceai-detail-back" href="/official-prices">← 返回官方订阅</Link>
      <section className="priceai-detail-hero">
        <div><span>官方订阅地区价</span><h1>{planName}</h1><p>逐条列出可核验的地区标价、人民币估算与官方来源。实际结算仍可能受到税费、支付手续费和账号地区限制影响。</p></div>
        <dl><div><dt>厂商</dt><dd>{companyNames[vendor] ?? vendor}</dd></div><div><dt>地区报价</dt><dd>{rows.length || "待接入"}</dd></div><div><dt>周期</dt><dd>{periodNames[billingPeriod] ?? billingPeriod}</dd></div></dl>
      </section>

      <div className="priceai-detail-region-link"><span>想直接比较同一套餐在各地区的价格？</span><Link href={`/official-prices/regions?plan=${encodeURIComponent(catalogPlan?.planCode ?? sample!.planCode)}`}>打开地区横向对照　›</Link></div>

      {rows.length ? <div className="priceai-detail-table-wrap"><table><thead><tr><th>地区</th><th>渠道</th><th>原币价格</th><th>人民币估算</th><th>价格精度</th><th>官方证据</th></tr></thead><tbody>{sorted.map((row) => <tr key={row.id}><td><b>{countryNames[row.countryCode] ?? row.countryCode}</b><small>{row.countryCode}</small></td><td>{channelNames[row.channel] ?? row.channel}</td><td>{row.amount ? `${row.currency} ${Number(row.amount).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}` : "未公开精确价"}</td><td><strong>{row.cnyEstimate ? `¥${Number(row.cnyEstimate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}</strong>{row.exchangeRateDate && row.exchangeRateUrl && <small><a href={row.exchangeRateUrl} target="_blank" rel="noopener noreferrer nofollow">汇率 {row.exchangeRateDate}　↗</a></small>}</td><td><em>{row.priceKind === "exact" ? "精确价" : row.priceKind === "range" ? "区间价" : "未知"}</em></td><td><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">查看官方来源　↗</a></td></tr>)}</tbody></table></div> : <section className="priceai-official-detail-empty" role="status"><span aria-hidden="true">⌁</span><div><h2>{databaseAvailable ? "这项订阅正在等待首条核验报价" : "价格数据库暂时未连接"}</h2><p>套餐目录已经收录，但 PriceAI 不会在缺少证据时填入估算价格。你可以先前往厂商页面查看当前结算金额。</p></div><a href={officialUrl} target="_blank" rel="noopener noreferrer nofollow">查看官方页面　↗</a></section>}

      <aside className="priceai-official-note"><b>购买前再确认</b><p>账号地区、付款卡归属地和应用商店区域可能影响价格与购买资格。PriceAI 展示的是核验记录，不替代最终结算页。</p></aside>
    </main>
    <SiteFooter />
  </div>;
}
