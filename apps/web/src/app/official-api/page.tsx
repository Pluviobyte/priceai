import { getOfficialApiPrices } from "@/lib/public-pricing";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

function money(value: string | null): string { return value === null ? "—" : `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 8 })}`; }

export default async function OfficialApiPage() {
  const prices = await getOfficialApiPrices();
  return <main><SiteHeader active="api" /><section className="listing-shell pricing-shell">
    <span className="section-kicker">Official API</span><h1>官方 API 定价</h1>
    <p className="listing-lead">输入、缓存输入、输出、批处理和多模态费用拆开记录。每条数据均指向厂商文档，定价变化时追加历史快照。</p>
    <div className="pricing-table-wrap"><table className="pricing-table api-pricing-table"><thead><tr><th>厂商 / 模型</th><th>层级</th><th>输入</th><th>缓存输入</th><th>输出</th><th>多模态 / 限制</th><th>证据</th></tr></thead><tbody>
      {prices.map((row) => <tr key={row.id}><td><b>{row.vendor}</b><strong>{row.modelName}</strong><small>{row.modelCode} · {row.modality}{row.contextWindow ? ` · ${(row.contextWindow / 1000).toLocaleString()}K context` : ""}</small></td><td><span className="quality-pill exact">{row.priceTier}</span><small>{row.unit}</small></td><td>{money(row.inputPrice)}</td><td>{money(row.cachedInputPrice)}</td><td>{money(row.outputPrice)}</td><td><details><summary>查看结构化计费</summary><pre>{JSON.stringify({ additionalPrices: row.additionalPrices, freeTier: row.freeTier, rateLimits: row.rateLimits }, null, 2)}</pre></details></td><td><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">官方文档 ↗</a><small>{row.documentVersion ?? "无文档版本"} · {row.historyCount} 版</small></td></tr>)}
    </tbody></table></div>
    {!prices.length && <div className="empty-state">尚未生成官方 API 快照。</div>}
  </section></main>;
}
