import type { Metadata } from "next";
import Link from "next/link";
import { getOfficialSubscriptionPrices, type OfficialSubscriptionPrice } from "@/lib/public-pricing";
import { SiteHeader } from "../site-header";
import { SiteFooter } from "../site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "官方订阅地区价 | PriceAI",
  description: "对比 AI 官方订阅在官网、iOS Store 与 Google Play 的公开地区价格。",
};

const vendorNames: Record<string, string> = { anthropic: "Claude", openai: "ChatGPT", google: "Gemini", xai: "Grok" };
const companyNames: Record<string, string> = { anthropic: "Anthropic", openai: "OpenAI", google: "Google", xai: "xAI" };
const channelNames: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const periodNames: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
const countryNames: Record<string, string> = {
  AR: "阿根廷", AU: "澳大利亚", BO: "玻利维亚", BR: "巴西", CA: "加拿大", CL: "智利", CN: "中国大陆",
  CO: "哥伦比亚", EG: "埃及", GB: "英国", HK: "中国香港", ID: "印度尼西亚", IN: "印度", JP: "日本",
  KR: "韩国", MX: "墨西哥", MY: "马来西亚", NG: "尼日利亚", NZ: "新西兰", PH: "菲律宾", PK: "巴基斯坦",
  SG: "新加坡", TH: "泰国", TR: "土耳其", TW: "中国台湾", US: "美国", VN: "越南", ZA: "南非",
};

type PlanGroup = {
  key: string;
  vendor: string;
  planCode: string;
  planName: string;
  billingPeriod: string;
  rows: OfficialSubscriptionPrice[];
  lowest: OfficialSubscriptionPrice | null;
  latest: Date | null;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function relative(value: Date | null): string {
  if (!value) return "未记录";
  const minutes = Math.max(1, Math.round((Date.now() - value.getTime()) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}小时前` : `${Math.round(hours / 24)}天前`;
}

function planHref(plan: PlanGroup): string {
  const vendor = vendorNames[plan.vendor.toLowerCase()]?.toLowerCase() ?? plan.vendor.toLowerCase();
  return `/official-prices/${encodeURIComponent(`${vendor}__${plan.planCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`)}`;
}

function groupPlans(rows: OfficialSubscriptionPrice[]): PlanGroup[] {
  const groups = new Map<string, OfficialSubscriptionPrice[]>();
  for (const row of rows) {
    const key = `${row.vendor}::${row.planCode}::${row.billingPeriod}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, groupRows]) => {
    const comparable = groupRows.filter((row) => row.priceKind === "exact" && row.cnyEstimate !== null);
    const lowest = comparable.sort((a, b) => Number(a.cnyEstimate) - Number(b.cnyEstimate))[0] ?? null;
    const latest = groupRows.reduce<Date | null>((current, row) => !current || row.verifiedAt > current ? row.verifiedAt : current, null);
    const sample = groupRows[0]!;
    return { key, vendor: sample.vendor, planCode: sample.planCode, planName: sample.planName, billingPeriod: sample.billingPeriod, rows: groupRows, lowest, latest };
  }).sort((a, b) => {
    const aPrice = a.lowest ? Number(a.lowest.cnyEstimate) : Number.POSITIVE_INFINITY;
    const bPrice = b.lowest ? Number(b.lowest.cnyEstimate) : Number.POSITIVE_INFINITY;
    return aPrice - bPrice || a.planName.localeCompare(b.planName, "zh-CN");
  });
}

export default async function OfficialPricesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const vendor = first(raw.vendor).trim().toLowerCase();
  const allRows = await getOfficialSubscriptionPrices();
  const allPlans = groupPlans(allRows);
  const query = q.toLocaleLowerCase("zh-CN");
  const plans = allPlans.filter((plan) => {
    const vendorMatch = !vendor || plan.vendor.toLowerCase() === vendor;
    const haystack = `${plan.planName} ${plan.planCode} ${vendorNames[plan.vendor.toLowerCase()] ?? plan.vendor} ${plan.rows.map((row) => `${row.countryCode} ${row.currency} ${row.channel}`).join(" ")}`.toLocaleLowerCase("zh-CN");
    return vendorMatch && (!query || haystack.includes(query));
  });
  const latest = allRows.reduce<Date | null>((current, row) => !current || row.verifiedAt > current ? row.verifiedAt : current, null);
  const rateDate = allRows.map((row) => row.exchangeRateDate).filter(Boolean).sort().at(-1) ?? "未记录";
  const channelCount = new Set(allRows.map((row) => row.channel)).size;
  const categories = [["全部", ""], ["ChatGPT", "openai"], ["Claude", "anthropic"], ["Gemini", "google"], ["Grok", "xai"]] as const;
  const filterHref = (nextVendor: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (nextVendor) params.set("vendor", nextVendor);
    return params.size ? `/official-prices?${params}` : "/official-prices";
  };

  return <div className="priceai-page priceai-catalog-page priceai-official-page"><SiteHeader active="official" />
    <nav className="priceai-category-rail" aria-label="按产品筛选">{categories.map(([label, value]) => <Link className={vendor === value ? "active" : undefined} href={filterHref(value)} key={label}>{label}</Link>)}</nav>
    <main className="priceai-catalog-shell">
      <section className="priceai-catalog-hero priceai-official-hero"><div><h1>全产品 · 全渠道 官方标准商品</h1><p className="priceai-catalog-intro">对比 iOS Store、Google Play 与官网直购的官方公开标价。人民币换算不额外叠加税费、银行手续费或支付渠道汇率。</p><p className="priceai-catalog-meta">最新渠道样本：{relative(latest)}　·　当前显示：{plans.length} 个标准套餐　·　汇率日期：{rateDate}　·　来源：本地数据库 + 官网公开快照</p></div><dl><div><dt>价格项目</dt><dd>{allPlans.length}</dd></div><div><dt>地区报价</dt><dd>{allRows.length}</dd></div><div><dt>订阅渠道</dt><dd>{channelCount}</dd></div></dl></section>
      <div className="priceai-catalog-toolbar priceai-official-toolbar"><form action="/official-prices"><label className="sr-only" htmlFor="official-query">搜索官方订阅</label><input id="official-query" name="q" defaultValue={q} placeholder="搜索 ChatGPT、Claude、Gemini、Grok" />{vendor && <input type="hidden" name="vendor" value={vendor} />}<button type="submit">⌕　筛选</button></form><nav aria-label="官方订阅视图"><Link className="active" href="/official-prices">◈ 标准商品</Link><Link href="/official-prices?view=quotes">▤ 全部报价</Link><Link href="/official-prices?filter=1">▱ 筛选</Link></nav></div>
      <div className="priceai-catalog-status"><span>{plans.length} 个匹配套餐</span>{(q || vendor) && <Link href="/official-prices">清空全部条件</Link>}</div>
      {plans.length ? <div className="priceai-data-table-wrap priceai-official-table-wrap"><table className="priceai-data-table priceai-official-table"><thead><tr><th>标准商品</th><th>产品</th><th>周期</th><th>最低地区价</th><th>最低地区</th><th>地区样本</th><th>最近更新</th></tr></thead><tbody>{plans.map((plan) => {
        const lowest = plan.lowest;
        const amount = lowest?.cnyEstimate ? `¥${Number(lowest.cnyEstimate).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "暂无精确价";
        const original = lowest?.amount ? `${lowest.currency} ${Number(lowest.amount).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}` : lowest?.currency ?? "—";
        return <tr key={plan.key}><td><Link href={planHref(plan)}><b>{plan.planName}</b><small>{companyNames[plan.vendor.toLowerCase()] ?? plan.vendor}</small></Link></td><td>{vendorNames[plan.vendor.toLowerCase()] ?? plan.vendor}</td><td>{periodNames[plan.billingPeriod] ?? plan.billingPeriod}</td><td><Link href={planHref(plan)}><strong>{amount}</strong><em>{lowest ? channelNames[lowest.channel] ?? lowest.channel : "无精确报价"}</em></Link></td><td><b>{lowest ? countryNames[lowest.countryCode] ?? lowest.countryCode : "—"}</b><small>{lowest ? original : "等待核验"}</small></td><td><b>{plan.rows.length}</b><small>公开地区报价</small></td><td><span>{relative(plan.latest)}</span><Link className="priceai-row-button" href={planHref(plan)}>查看　›</Link></td></tr>;
      })}</tbody></table></div> : <div className="empty-state">没有匹配的官方订阅套餐，请尝试其他关键词或产品。</div>}
      <aside className="priceai-official-note"><b>价格换算提示</b><p>人民币估算基于数据库内最近汇率快照，不额外计入当地税费、银行卡跨境手续费或应用商店结算差异。购买前请以官方结算页为准。</p></aside>
      <p className="priceai-catalog-disclaimer">免责声明：PriceAI 仅整理官方公开价格与证据链接，不销售订阅、不代购，也不保证地区购买资格或支付可用性。</p>
    </main><SiteFooter />
  </div>;
}
