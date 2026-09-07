import type { Metadata } from "next";
import Link from "next/link";
import { getTransitOverview, type TransitModelPrice, type TransitProviderOverview } from "@/lib/public-pricing";
import { SiteFooter } from "../site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "API 中转站价格榜 | PriceAI",
  description: "比较主流 API 中转站的公开价格、倍率、近 7 日稳定性、模型覆盖与来源渠道。",
};

const categories = ["全部", "ChatGPT", "Claude", "Gemini", "Grok", "GLM", "DeepSeek", "Kimi", "千问", "图片生成", "视频生成"] as const;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function dateTime(value: Date | null, full = false): string {
  if (!value) return "未记录";
  const parts = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(value).replaceAll("/", "-");
  if (!full) return parts;
  return `${value.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" })} ${parts.split(" ").at(-1)}`;
}

function modelFamily(price: TransitModelPrice): string {
  const text = `${price.modelCode} ${price.displayName}`.toLowerCase();
  if (text.includes("claude") || text.includes("anthropic")) return "Claude";
  if (text.includes("gemini") || text.includes("google")) return "Gemini";
  if (text.includes("grok") || text.includes("x-ai")) return "Grok";
  if (text.includes("deepseek")) return "DeepSeek";
  if (text.includes("glm") || text.includes("z-ai")) return "GLM";
  if (text.includes("kimi") || text.includes("moonshot")) return "Kimi";
  if (text.includes("qwen") || text.includes("alibaba")) return "千问";
  if (text.includes("image") || text.includes("flux") || text.includes("dall")) return "图片生成";
  if (text.includes("video") || text.includes("sora") || text.includes("veo")) return "视频生成";
  return "ChatGPT";
}

function familyRanges(prices: TransitModelPrice[]): Array<{ family: string; min: number; max: number }> {
  const groups = new Map<string, number[]>();
  for (const price of prices) {
    const value = price.multiplier !== null ? Number(price.multiplier) : price.inputPrice !== null ? Number(price.inputPrice) : Number.NaN;
    if (!Number.isFinite(value) || value <= 0) continue;
    const family = modelFamily(price);
    groups.set(family, [...(groups.get(family) ?? []), value]);
  }
  return [...groups.entries()].map(([family, values]) => ({ family, min: Math.min(...values), max: Math.max(...values) })).sort((a, b) => a.min - b.min).slice(0, 4);
}

function lowest(prices: TransitModelPrice[]): { value: number | null; family: string; isMultiplier: boolean } {
  const multiplierRows = prices.filter((price) => price.multiplier !== null && Number.isFinite(Number(price.multiplier)) && Number(price.multiplier) > 0);
  const rows = multiplierRows.length ? multiplierRows : prices.filter((price) => price.inputPrice !== null && Number.isFinite(Number(price.inputPrice)) && Number(price.inputPrice) > 0);
  const row = [...rows].sort((a, b) => Number(multiplierRows.length ? a.multiplier : a.inputPrice) - Number(multiplierRows.length ? b.multiplier : b.inputPrice))[0];
  return row ? { value: Number(multiplierRows.length ? row.multiplier : row.inputPrice), family: modelFamily(row), isMultiplier: multiplierRows.length > 0 } : { value: null, family: "暂无", isMultiplier: false };
}

function sourceLabels(provider: TransitProviderOverview): string[] {
  const labels: string[] = [];
  if (provider.operatorName) labels.push("运营主体公开");
  if (provider.statusUrl) labels.push("状态页");
  labels.push(provider.apiBaseUrl ? "官方 API" : "站方公开");
  return labels.slice(0, 3);
}

export default async function ApiTransitPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const category = first(raw.category).trim();
  const sort = first(raw.sort) || "recommended";
  const data = await getTransitOverview();
  const query = q.toLocaleLowerCase("zh-CN");
  const pricesByProvider = new Map<string, TransitModelPrice[]>();
  for (const price of data.prices) pricesByProvider.set(price.providerSlug, [...(pricesByProvider.get(price.providerSlug) ?? []), price]);
  const providers = data.providers.filter((provider) => {
    const prices = pricesByProvider.get(provider.slug) ?? [];
    const matchesQuery = !query || `${provider.displayName} ${provider.operatorName ?? ""} ${provider.systemKind} ${prices.map((price) => `${price.displayName} ${price.modelCode}`).join(" ")}`.toLocaleLowerCase("zh-CN").includes(query);
    const matchesCategory = !category || prices.some((price) => modelFamily(price) === category);
    return matchesQuery && matchesCategory;
  });
  providers.sort((a, b) => sort === "price" ? (lowest(pricesByProvider.get(a.slug) ?? []).value ?? Infinity) - (lowest(pricesByProvider.get(b.slug) ?? []).value ?? Infinity) : sort === "stability" ? (b.successRate7d ?? -1) - (a.successRate7d ?? -1) : (b.successRate7d ?? -1) - (a.successRate7d ?? -1) || b.sampleCount7d - a.sampleCount7d);
  const latest = data.providers.reduce<Date | null>((current, provider) => !provider.lastCheckedAt ? current : !current || provider.lastCheckedAt > current ? provider.lastCheckedAt : current, null);
  const sampleCount = data.providers.reduce((sum, provider) => sum + provider.sampleCount7d, 0);
  const globalLows = familyRanges(data.prices);

  return <div className="priceai-page priceai-transit-page">
    <nav className="priceai-category-rail" aria-label="按模型分类筛选">{categories.map((label) => <Link className={category === (label === "全部" ? "" : label) ? "active" : undefined} href={label === "全部" ? "/api-transit" : `/api-transit?category=${encodeURIComponent(label)}`} key={label}>{label}</Link>)}</nav>
    <main className="priceai-transit-shell">
      <section className="priceai-transit-hero"><div><h1>API 中转站价格榜</h1><p className="priceai-transit-meta">最近更新：{dateTime(latest, true).split(" ")[0]}　·　样本 {sampleCount}{globalLows.slice(0, 2).map((item) => <span key={item.family}>　·　{item.family} 最低 {item.min.toLocaleString("en-US", { maximumFractionDigits: 3 })}{data.prices.some((price) => price.multiplier !== null) ? "x" : ""}</span>)}</p><p>先把主流 API 中转站的价格和稳定性比清楚。这里展示充值系数、模型倍率、综合倍率、近 7 日可用性和来源渠道；不售卖 API，不替商家担保。没有完成审核发布的数据不会出现在榜单里，使用前仍建议小额试用并回原站核验。</p></div><div className="priceai-transit-actions"><Link className="primary" href="/api-transit/detector">♧　模型检测</Link><Link href="/guides/api-transit">▣　使用前说明</Link><Link className="apply" href="/submit">▱　申请收录</Link></div></section>
      <aside className="priceai-transit-guide" aria-label="使用前先看"><span>▣　使用前先看</span><Link href="/guides/api-transit">充值系数和综合倍率</Link><b>·</b><Link href="/guides/api-transit">模型真假怎么判断</Link><b>·</b><Link href="/guides/api-transit">为什么要小额试用</Link><b>·</b><small>价格榜只做购买前参考，充值前仍要回原站确认余额、退款和售后规则。</small><Link className="guide-link" href="/guides/api-transit">中转指南　›</Link></aside>
      <section className="priceai-transit-toolbar"><form action="/api-transit"><label className="sr-only" htmlFor="transit-query">搜索中转站或模型</label><input id="transit-query" name="q" defaultValue={q} placeholder="搜索站点名称、描述..." />{category && <input type="hidden" name="category" value={category} />}</form><nav aria-label="中转 API 视图切换"><Link className="active" href="/api-transit">▥　站点</Link><Link href="/api-transit/models">♧　模型</Link></nav><label className="priceai-transit-sort">↕ <select name="sort" defaultValue={sort}><option value="recommended">综合推荐</option><option value="price">最低价格</option><option value="stability">稳定性优先</option></select></label><button type="button">▽ 筛选</button></section>
      {providers.length ? <div className="priceai-transit-table-wrap"><table className="priceai-transit-table"><thead><tr><th>站点</th><th>最低文本综合倍率</th><th>倍率构成</th><th>稳定性</th><th>模型检测</th><th>来源渠道</th><th>价格更新</th><th>操作</th></tr></thead><tbody>{providers.map((provider) => {
        const prices = pricesByProvider.get(provider.slug) ?? [];
        const ranges = familyRanges(prices);
        const low = lowest(prices);
        return <tr key={provider.id}><td><a href={provider.websiteUrl} target="_blank" rel="noopener noreferrer nofollow"><span className="priceai-transit-logo">{provider.displayName.slice(0, 1)}</span><span><b>{provider.displayName}</b><em>{provider.systemKind.replaceAll("_", " ")}</em><small>{provider.operatorName ?? "运营主体未公开"}</small></span></a></td><td>{low.value === null ? <b>暂无公开价格</b> : <><strong>{low.value.toLocaleString("en-US", { maximumFractionDigits: 4 })}{low.isMultiplier ? "x" : ""}</strong><small>{low.family} 最低</small><small>{low.isMultiplier ? `¥${low.value.toFixed(2)} / 刀` : `$${low.value.toFixed(4)} / M`}</small></>}</td><td><span>公开模型价　<b>{prices.length} 项</b></span><div className="priceai-transit-ranges">{ranges.map((range) => <em key={range.family}>{range.family} {range.min.toLocaleString("en-US", { maximumFractionDigits: 3 })}{range.max !== range.min ? `–${range.max.toLocaleString("en-US", { maximumFractionDigits: 3 })}` : ""}{low.isMultiplier ? "x" : ""}</em>)}</div><small>缓存命中率　样本不足</small></td><td>{provider.successRate7d === null ? <><b className="warning">暂无监测数据</b><small>尚未获得可用性样本</small></> : <><small>文本综合稳定性</small><b>{(provider.successRate7d * 100).toFixed(1)}% · 样本 {provider.sampleCount7d}</b><span className="priceai-stability-bars">{Array.from({ length: 18 }, (_, index) => <i className={index / 18 < provider.successRate7d! ? "ok" : "bad"} key={index} />)}</span><small>{dateTime(provider.lastCheckedAt)}　站方公开</small><em>最近 {provider.averageLatency7d ? `${(provider.averageLatency7d / 1000).toFixed(1)}s` : "—"} · 7日均</em></>}</td><td><span className="priceai-detect">♧　待检测</span><small>暂无模型真伪报告</small><Link href={`/api-transit/detector?station=${encodeURIComponent(provider.slug)}`}>去检测</Link></td><td><div className="priceai-source-tags">{sourceLabels(provider).map((label) => <em key={label}>{label}</em>)}</div></td><td><time>{dateTime(provider.lastCheckedAt)}</time></td><td><Link className="priceai-row-button" href={`/api-transit/${provider.slug}`}>查看　›</Link></td></tr>;
      })}</tbody></table></div> : <div className="empty-state">没有匹配的中转站，请调整搜索关键词或模型分类。</div>}
      <p className="priceai-transit-count">共 {providers.length} 个站点</p>
    </main><SiteFooter />
  </div>;
}
