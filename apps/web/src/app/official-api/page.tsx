import type { Metadata } from "next";
import Link from "next/link";
import { OFFICIAL_API_SPONSOR_ENABLED } from "@/lib/site-features";
import { getOfficialApiPrices, getOfficialSubscriptionPrices, type OfficialApiPrice } from "@/lib/public-pricing";
import { SiteFooter } from "../site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "官方 API | PriceAI",
  description: "比较 AI 厂商官方 API 模型、输入输出 token 价格与来源渠道。",
};

const vendorAliases: Record<string, string> = { Anthropic: "Claude", Google: "Gemini", OpenAI: "OpenAI", SpaceXAI: "Grok" };
const vendorIcons: Record<string, string> = { Anthropic: "claude-official.svg", Google: "gemini-official.svg", OpenAI: "openai.svg", SpaceXAI: "grok.svg" };
const categoryVendors: ReadonlyArray<readonly [string, string]> = [
  ["全部", ""], ["OpenAI", "OpenAI"], ["Claude", "Anthropic"], ["Gemini", "Google"], ["Grok", "SpaceXAI"],
  ["DeepSeek", "DeepSeek"], ["Qwen", "Qwen"], ["Kimi", "Kimi"], ["GLM", "GLM"], ["MiniMax", "MiniMax"],
  ["MiMo", "MiMo"], ["StepFun", "StepFun"], ["图片生成", "image"], ["视频生成", "video"],
];

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function money(value: string | null, currency = "USD"): string {
  if (value === null) return "—";
  const prefix = currency === "USD" ? "$" : `${currency} `;
  return `${prefix}${Number(value).toLocaleString("en-US", { maximumFractionDigits: 8 })}`;
}

function date(value: Date | null): string {
  if (!value) return "未记录";
  return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(value).replaceAll("/", "-");
}

function groupByVendor(prices: OfficialApiPrice[]): Array<{ vendor: string; rows: OfficialApiPrice[]; latest: Date | null }> {
  const groups = new Map<string, OfficialApiPrice[]>();
  for (const row of prices) groups.set(row.vendor, [...(groups.get(row.vendor) ?? []), row]);
  return [...groups.entries()].map(([vendor, rows]) => ({
    vendor,
    rows,
    latest: rows.reduce<Date | null>((current, row) => !current || row.verifiedAt > current ? row.verifiedAt : current, null),
  }));
}

export default async function OfficialApiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const vendor = first(raw.vendor).trim();
  const allPrices = await getOfficialApiPrices();
  const subscriptions = await getOfficialSubscriptionPrices();
  const query = q.toLocaleLowerCase("zh-CN");
  const prices = allPrices.filter((row) => {
    const vendorMatch = !vendor || row.vendor === vendor || (vendor === "image" && row.modality.includes("image")) || (vendor === "video" && row.modality.includes("video"));
    const haystack = `${row.vendor} ${vendorAliases[row.vendor] ?? ""} ${row.modelName} ${row.modelCode} ${row.modality} ${row.priceTier}`.toLocaleLowerCase("zh-CN");
    return vendorMatch && (!query || haystack.includes(query));
  });
  const groups = groupByVendor(prices);
  const uniqueModels = new Set(allPrices.map((row) => `${row.vendor}:${row.modelCode}`)).size;
  const uniqueSubscriptionPlans = new Set(subscriptions.map((row) => `${row.vendor}:${row.planCode}:${row.billingPeriod}`)).size;
  const latest = allPrices.reduce<Date | null>((current, row) => !current || row.verifiedAt > current ? row.verifiedAt : current, null);
  const categoryHref = (nextVendor: string) => nextVendor ? `/official-api?vendor=${encodeURIComponent(nextVendor)}` : "/official-api";

  return <div className="priceai-page priceai-api-page">
    <nav className="priceai-category-rail priceai-api-categories" aria-label="按厂商或模型类型筛选">{categoryVendors.map(([label, value]) => <Link className={vendor === value ? "active" : undefined} href={categoryHref(value)} key={label}>{label}</Link>)}</nav>
    <main className="priceai-catalog-shell priceai-api-shell">
      <section className="priceai-catalog-hero priceai-official-hero priceai-api-hero"><div><h1>官方订阅与 Token Plan</h1><p className="priceai-catalog-intro">标准模型是一套官方 API 基准价格库：文本模型按输入、输出和缓存 token 看，图片/视频生成按官方公开的图片或视频计费单位展示；来源渠道页用来查看官方订阅与 Token Plan 额度。</p><p className="priceai-catalog-meta">数据库同步：{date(latest)}　·　当前显示：{groups.length} 个官方来源渠道　·　价格单位以厂商文档为准</p></div><dl><div><dt>模型</dt><dd>{uniqueModels}</dd></div><div><dt>渠道</dt><dd>{new Set(allPrices.map((row) => row.vendor)).size}</dd></div><div><dt>报价</dt><dd>{allPrices.length}</dd></div><div><dt>订阅</dt><dd>{uniqueSubscriptionPlans}</dd></div></dl></section>
      {OFFICIAL_API_SPONSOR_ENABLED && <section className="priceai-api-sponsor" aria-label="赞助占位"><span>赞助位 · 待开放</span></section>}
      <section className="priceai-api-toolbar"><div className="priceai-api-toolbar-main"><form action="/official-api"><label className="sr-only" htmlFor="api-query">搜索官方 API 模型</label><input id="api-query" name="q" defaultValue={q} placeholder="搜索 ChatGPT、Claude、Gemini、OpenCode Go" />{vendor && <input type="hidden" name="vendor" value={vendor} />}</form><nav aria-label="官方 API 数据视图"><Link href="/official-api?view=models">◈ 标准模型</Link><Link href="/official-api?view=quotes">▤ 全部报价</Link><Link className="active" href="/official-api">◉ 来源渠道</Link></nav><div className="priceai-currency-switch"><button className="active" type="button">美元</button><button type="button">人民币</button></div><Link className="priceai-api-submit" href="/submit">⌁　提交 API 渠道</Link></div><div className="priceai-api-type-filters"><Link className="active" href="/official-api">订阅/Token Plan</Link><Link href="/official-api?type=official">官方 API</Link><Link href="/official-api?type=free">免费/测试</Link><Link href="/official-api?type=all">全部类型</Link></div></section>
      {groups.length ? <div className="priceai-api-table-wrap"><table className="priceai-api-table"><thead><tr><th>渠道/订阅</th><th>类型</th><th>套餐额度</th><th>覆盖/边界</th><th>最近更新</th></tr></thead><tbody>{groups.map((group) => {
        const models = [...new Map(group.rows.map((row) => [row.modelCode, row])).values()];
        const label = vendorAliases[group.vendor] ?? group.vendor;
        return <tr key={group.vendor}><td><Link href={`/official-api/providers/${group.vendor.toLowerCase()}`}><span className="priceai-provider-name"><img src={`/model-icons/${vendorIcons[group.vendor] ?? "openai.svg"}`} alt="" /><b>{label} 官方 API</b></span><small>{group.vendor} 官方模型与公开计费文档。</small></Link></td><td><span className="priceai-type-pill">官方 API</span></td><td><div className="priceai-api-plans">{group.rows.map((row) => <a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" key={row.id}><span><b>{row.modelName}</b><strong>{money(row.inputPrice, row.currency)} / {money(row.outputPrice, row.currency)}</strong></span><p>{row.priceTier === "batch" ? "批处理" : "标准计费"} · 输入 / 输出 · {row.unit.replaceAll("_", " ")}</p>{row.cachedInputPrice && <em>缓存输入 {money(row.cachedInputPrice, row.currency)}</em>}</a>)}</div></td><td><b>{models.length} 个覆盖项</b><p>{models.map((row) => row.modelName).join("、")}</p><small>{group.rows.some((row) => row.modality.includes("image")) ? "包含图片或多模态输入；" : ""}具体上下文、速率限制与可用地区以官方文档为准。</small></td><td><p>{date(group.latest)}</p><a className="priceai-row-button" href={group.rows[0]?.evidenceUrl ?? "/official-api"} target="_blank" rel="noopener noreferrer nofollow">查看　›</a></td></tr>;
      })}</tbody></table></div> : <div className="empty-state">没有匹配的官方 API 来源渠道，请尝试其他关键词或模型分类。</div>}
      <aside className="priceai-official-note priceai-api-note"><b>API 价格阅读提示</b><p>输入、缓存输入、输出与批处理价格不能直接混在一起比较。上下文长度、免费额度、地域与速率限制也可能影响实际成本。</p></aside>
      <p className="priceai-api-disclaimer">免责声明：PriceAI 只整理公开文档和公开页面中的 API 渠道信息，不售卖 API、不承诺可用性，也不替任何渠道提供 SLA。</p>
    </main><SiteFooter />
  </div>;
}
