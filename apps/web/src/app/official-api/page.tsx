import { getOfficialApiPrices } from "@/lib/public-pricing";
import Link from "next/link";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

function money(value: string | null): string { return value === null ? "—" : `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 8 })}`; }
function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function OfficialApiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const selectedVendor = first(raw.vendor).trim();
  const allPrices = await getOfficialApiPrices();
  const vendorOptions = [...new Set(allPrices.map((row) => row.vendor))];
  const prices = allPrices.filter((row) => {
    const text = `${row.vendor} ${row.modelName} ${row.modelCode} ${row.modality} ${row.priceTier}`.toLocaleLowerCase("zh-CN");
    return (!selectedVendor || row.vendor === selectedVendor) && (!q || text.includes(q.toLocaleLowerCase("zh-CN")));
  });
  return <main><SiteHeader active="api" /><section className="listing-shell pricing-shell">
    <div className="channel-title-row"><div><span className="section-kicker">Official API</span><h1>官方 API 定价</h1><p className="listing-lead">输入、缓存输入、输出、批处理和多模态费用拆开记录。每条数据均指向厂商文档，定价变化时追加历史快照。</p></div><dl className="channel-stats"><div><dt>模型价格</dt><dd>{allPrices.length}</dd></div><div><dt>厂商</dt><dd>{vendorOptions.length}</dd></div><div><dt>历史版本</dt><dd>{allPrices.reduce((sum, row) => sum + row.historyCount, 0)}</dd></div></dl></div>
    <aside className="guide-strip"><div><span>阅读提示</span><b>输入价、缓存价和输出价要分开看</b></div><p>模型名相近也可能对应不同上下文、批处理或多模态计费，最终以厂商文档为准。</p><Link href="/methodology">了解核验规则</Link></aside>
    <div className="catalog-toolbar"><form className="compact-search" action="/official-api"><label className="sr-only" htmlFor="api-query">搜索厂商或模型</label><input id="api-query" name="q" defaultValue={q} placeholder="搜索 OpenAI、Claude、Gemini、模型名…" />{selectedVendor && <input type="hidden" name="vendor" value={selectedVendor} />}<button type="submit">搜索</button></form><nav className="filter-links" aria-label="按 API 厂商筛选"><Link className={!selectedVendor ? "active" : undefined} href="/official-api">全部</Link>{vendorOptions.map((vendor) => <Link className={selectedVendor === vendor ? "active" : undefined} href={`/official-api?vendor=${encodeURIComponent(vendor)}`} key={vendor}>{vendor}</Link>)}</nav></div>
    <div className="pricing-table-wrap"><table className="pricing-table api-pricing-table"><thead><tr><th>厂商 / 模型</th><th>层级</th><th>输入</th><th>缓存输入</th><th>输出</th><th>多模态 / 限制</th><th>证据</th></tr></thead><tbody>
      {prices.map((row) => <tr key={row.id}><td><b>{row.vendor}</b><strong>{row.modelName}</strong><small>{row.modelCode} · {row.modality}{row.contextWindow ? ` · ${(row.contextWindow / 1000).toLocaleString()}K context` : ""}</small></td><td><span className="quality-pill exact">{row.priceTier}</span><small>{row.unit}</small></td><td>{money(row.inputPrice)}</td><td>{money(row.cachedInputPrice)}</td><td>{money(row.outputPrice)}</td><td><details><summary>查看结构化计费</summary><pre>{JSON.stringify({ additionalPrices: row.additionalPrices, freeTier: row.freeTier, rateLimits: row.rateLimits }, null, 2)}</pre></details></td><td><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">官方文档 ↗</a><small>{row.documentVersion ?? "无文档版本"} · {row.historyCount} 版</small></td></tr>)}
    </tbody></table></div>
    {!prices.length && <div className="empty-state">没有匹配的官方 API 定价，请调整搜索或厂商筛选。</div>}
  </section></main>;
}
