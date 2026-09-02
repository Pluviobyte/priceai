import { getTransitOverview } from "@/lib/public-pricing";
import { SiteHeader } from "../site-header";
import { ModelChecker } from "./model-checker";

export const dynamic = "force-dynamic";

export default async function ApiTransitPage() {
  const data = await getTransitOverview();
  return <main><SiteHeader active="transit" /><section className="listing-shell pricing-shell">
    <span className="section-kicker">API gateway evidence</span><h1>API 中转比价</h1>
    <p className="listing-lead">把“站点自报价”、“公开监测”和“平台实测”分开展示。当前自动检查公开模型目录，不会把目录可用误当成付费推理可用。</p>
    <div className="transit-grid">{data.providers.map((provider) => <article key={provider.id}><div className="review-facts"><span>{provider.systemKind}</span><span>{provider.sampleCount7d} 个 7 日样本</span></div><h2>{provider.displayName}</h2><p>{provider.operatorName ?? "运营主体未公开"}</p><dl><div><dt>模型价格</dt><dd>{provider.modelCount}</dd></div><div><dt>7 日成功率</dt><dd>{provider.successRate7d === null ? "—" : `${(provider.successRate7d * 100).toFixed(1)}%`}</dd></div><div><dt>平均延迟</dt><dd>{provider.averageLatency7d === null ? "—" : `${Math.round(provider.averageLatency7d)} ms`}</dd></div><div><dt>最近检查</dt><dd>{provider.lastCheckedAt ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "short" }).format(provider.lastCheckedAt) : "—"}</dd></div></dl><div className="source-links"><a href={provider.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">官网 ↗</a><a href={provider.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">接口证据 ↗</a>{provider.statusUrl && <a href={provider.statusUrl} target="_blank" rel="noopener noreferrer nofollow">状态页 ↗</a>}</div></article>)}</div>
    <section className="price-vendor"><div className="section-heading"><div><span className="section-kicker">Provider reported</span><h2>公开模型价格</h2></div><span className="section-note">单位：USD / 百万 tokens</span></div><div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th>中转站</th><th>模型</th><th>输入</th><th>输出</th><th>证据类型</th><th>核验</th></tr></thead><tbody>{data.prices.map((price) => <tr key={`${price.providerSlug}:${price.modelCode}`}><td>{price.providerName}</td><td><b>{price.displayName}</b><small>{price.modelCode}</small></td><td>{price.inputPrice === null ? "—" : `$${Number(price.inputPrice).toFixed(4)}`}</td><td>{price.outputPrice === null ? "—" : `$${Number(price.outputPrice).toFixed(4)}`}</td><td><span className="quality-pill range">站点自报</span></td><td><a href={price.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">公开目录 ↗</a></td></tr>)}</tbody></table></div></section>
    {data.events.length > 0 && <section className="timeline"><span className="section-kicker">Timeline</span><h2>事件时间线</h2>{data.events.map((event, index) => <article key={`${event.providerName}:${event.startedAt.toISOString()}:${index}`}><time>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(event.startedAt)}</time><div><b>{event.providerName} · {event.title}</b><p>{event.details}</p></div></article>)}</section>}
    <ModelChecker />
  </section></main>;
}
