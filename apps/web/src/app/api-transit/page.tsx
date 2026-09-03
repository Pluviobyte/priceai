import Link from "next/link";
import { getTransitOverview } from "@/lib/public-pricing";
import { SiteHeader } from "../site-header";
import { ModelChecker } from "./model-checker";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function ApiTransitPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const sort = first(raw.sort) || "recommended";
  const minSuccess = Number(first(raw.minSuccess));
  const maxLatency = Number(first(raw.maxLatency));
  const hasMinSuccess = Number.isFinite(minSuccess) && minSuccess >= 0 && minSuccess <= 100 && first(raw.minSuccess) !== "";
  const hasMaxLatency = Number.isFinite(maxLatency) && maxLatency >= 0 && first(raw.maxLatency) !== "";
  const monitoredOnly = first(raw.monitored) === "yes";
  const data = await getTransitOverview();
  const query = q.toLocaleLowerCase("zh-CN");
  const modelTerms = new Map<string, string>();
  for (const price of data.prices) modelTerms.set(price.providerSlug, `${modelTerms.get(price.providerSlug) ?? ""} ${price.displayName} ${price.modelCode}`);
  const providers = data.providers.filter((provider) => {
    const matchesQuery = !query || `${provider.displayName} ${provider.operatorName ?? ""} ${provider.systemKind} ${modelTerms.get(provider.slug) ?? ""}`.toLocaleLowerCase("zh-CN").includes(query);
    const matchesSuccess = !hasMinSuccess || (provider.successRate7d !== null && provider.successRate7d * 100 >= minSuccess);
    const matchesLatency = !hasMaxLatency || (provider.averageLatency7d !== null && provider.averageLatency7d <= maxLatency);
    const matchesMonitoring = !monitoredOnly || provider.sampleCount7d > 0;
    return matchesQuery && matchesSuccess && matchesLatency && matchesMonitoring;
  });

  providers.sort((a, b) => {
    if (sort === "latency") return (a.averageLatency7d ?? Number.POSITIVE_INFINITY) - (b.averageLatency7d ?? Number.POSITIVE_INFINITY);
    if (sort === "samples") return b.sampleCount7d - a.sampleCount7d;
    return (b.successRate7d ?? -1) - (a.successRate7d ?? -1) || b.sampleCount7d - a.sampleCount7d;
  });

  const visibleProviderSlugs = new Set(providers.map((provider) => provider.slug));
  const prices = data.prices.filter((price) => visibleProviderSlugs.has(price.providerSlug));
  const monitoredProviders = data.providers.filter((provider) => provider.sampleCount7d > 0);
  const averageSuccess = monitoredProviders.length
    ? monitoredProviders.reduce((sum, provider) => sum + (provider.successRate7d ?? 0), 0) / monitoredProviders.length
    : null;

  return (
    <main>
      <SiteHeader active="transit" />
      <section className="listing-shell pricing-shell">
        <div className="channel-title-row">
          <div>
            <span className="section-kicker">API gateway evidence</span>
            <h1>API 中转比价</h1>
            <p className="listing-lead">把“站点自报价”、“公开监测”和“平台实测”分开展示。公开目录可用不等于付费推理一定可用，使用前建议小额试用。</p>
          </div>
          <dl className="channel-stats">
            <div><dt>中转站</dt><dd>{data.providers.length}</dd></div>
            <div><dt>公开模型价</dt><dd>{data.prices.length}</dd></div>
            <div><dt>有监测样本</dt><dd>{monitoredProviders.length}</dd></div>
            <div><dt>平均成功率</dt><dd>{averageSuccess === null ? "—" : `${(averageSuccess * 100).toFixed(1)}%`}</dd></div>
          </dl>
        </div>

        <div className="channel-actions">
          <a className="primary-cta" href="#model-checker">一次性模型检测</a>
          <Link className="secondary-cta" href="/methodology">使用前说明</Link>
          <Link className="secondary-cta" href="/submit">申请收录</Link>
        </div>

        <aside className="guide-strip">
          <div><span>使用前先看</span><b>低倍率、稳定性与来源披露要一起判断</b></div>
          <p>站点自报价格、公开状态页和平台实测是三类不同证据，不能相互替代。</p>
          <Link href="/methodology">了解证据边界</Link>
        </aside>

        <form className="transit-toolbar transit-filter-toolbar" action="/api-transit">
          <label className="sr-only" htmlFor="transit-query">搜索中转站或模型</label>
          <input id="transit-query" name="q" defaultValue={q} placeholder="搜索站点名称、系统或模型…" />
          <label><span>成功率至少</span><input name="minSuccess" type="number" min="0" max="100" step="0.1" defaultValue={hasMinSuccess ? minSuccess : undefined} placeholder="不限 %" /></label>
          <label><span>延迟至多</span><input name="maxLatency" type="number" min="0" step="1" defaultValue={hasMaxLatency ? maxLatency : undefined} placeholder="不限 ms" /></label>
          <label><span>排序</span><select name="sort" defaultValue={sort}><option value="recommended">稳定性优先</option><option value="latency">低延迟优先</option><option value="samples">样本量优先</option></select></label>
          <label className="check-filter"><input name="monitored" type="checkbox" value="yes" defaultChecked={monitoredOnly} /><span>仅看有监测样本</span></label>
          <button type="submit">应用</button>
        </form>
        <div className="catalog-status"><span>{providers.length} 个匹配中转站，{prices.length} 条模型价格</span><span>成功率与延迟均按近 7 日平台样本</span>{(q || hasMinSuccess || hasMaxLatency || monitoredOnly || sort !== "recommended") ? <Link href="/api-transit">清空全部条件</Link> : <span>可直接搜索模型名称</span>}</div>

        <div className="transit-grid">
          {providers.map((provider) => (
            <article key={provider.id}>
              <div className="review-facts"><span>{provider.systemKind}</span><span>{provider.sampleCount7d} 个 7 日样本</span></div>
              <h2>{provider.displayName}</h2>
              <p>{provider.operatorName ?? "运营主体未公开"}</p>
              <dl>
                <div><dt>模型价格</dt><dd>{provider.modelCount}</dd></div>
                <div><dt>7 日成功率</dt><dd>{provider.successRate7d === null ? "—" : `${(provider.successRate7d * 100).toFixed(1)}%`}</dd></div>
                <div><dt>平均延迟</dt><dd>{provider.averageLatency7d === null ? "—" : `${Math.round(provider.averageLatency7d)} ms`}</dd></div>
                <div><dt>最近检查</dt><dd>{provider.lastCheckedAt ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "short" }).format(provider.lastCheckedAt) : "—"}</dd></div>
              </dl>
              <div className="source-links"><a href={provider.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">官网 ↗</a><a href={provider.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">接口证据 ↗</a>{provider.statusUrl && <a href={provider.statusUrl} target="_blank" rel="noopener noreferrer nofollow">状态页 ↗</a>}</div>
            </article>
          ))}
        </div>
        {!providers.length && <div className="empty-state">没有匹配的中转站，请调整搜索条件。</div>}

        <section className="price-vendor">
          <div className="section-heading"><div><span className="section-kicker">Provider reported</span><h2>公开模型价格</h2></div><span className="section-note">单位：USD / 百万 tokens</span></div>
          <div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th>中转站</th><th>模型</th><th>输入</th><th>输出</th><th>证据类型</th><th>核验</th></tr></thead><tbody>{prices.map((price) => <tr key={`${price.providerSlug}:${price.modelCode}`}><td>{price.providerName}</td><td><b>{price.displayName}</b><small>{price.modelCode}</small></td><td>{price.inputPrice === null ? "—" : `$${Number(price.inputPrice).toFixed(4)}`}</td><td>{price.outputPrice === null ? "—" : `$${Number(price.outputPrice).toFixed(4)}`}</td><td><span className="quality-pill range">站点自报</span></td><td><a href={price.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">公开目录 ↗</a></td></tr>)}</tbody></table></div>
        </section>

        {data.events.length > 0 && <section className="timeline"><span className="section-kicker">Timeline</span><h2>事件时间线</h2>{data.events.map((event, index) => <article key={`${event.providerName}:${event.startedAt.toISOString()}:${index}`}><time>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(event.startedAt)}</time><div><b>{event.providerName} · {event.title}</b><p>{event.details}</p></div></article>)}</section>}
        <ModelChecker />
      </section>
    </main>
  );
}
