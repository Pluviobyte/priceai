import { getPublicChannels } from "@/lib/public-catalog";
import Link from "next/link";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function date(value: Date | null): string {
  return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium" }).format(value) : "—";
}

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const health = first(raw.health);
  const sort = first(raw.sort) || "recent";
  const enabledOnly = first(raw.enabled) === "yes";
  const query = q.toLocaleLowerCase("zh-CN");
  const allChannels = await getPublicChannels();
  const healthOptions = [...new Set(allChannels.map((channel) => channel.healthStatus))].sort();
  const channels = allChannels.filter((channel) => {
    const matchesQuery = !query || `${channel.merchantName} ${channel.collectorKind} ${channel.websiteUrl}`.toLocaleLowerCase("zh-CN").includes(query);
    return matchesQuery && (!health || channel.healthStatus === health) && (!enabledOnly || channel.enabled);
  });
  channels.sort((a, b) => {
    if (sort === "name") return a.merchantName.localeCompare(b.merchantName, "zh-CN");
    if (sort === "products") return (b.expectedProductCount ?? -1) - (a.expectedProductCount ?? -1);
    return (b.lastSuccessAt?.getTime() ?? 0) - (a.lastSuccessAt?.getTime() ?? 0);
  });
  const hasFilters = Boolean(q || health || enabledOnly || sort !== "recent");

  return (
    <main>
      <SiteHeader active="channels" />
      <section className="listing-shell">
        <div className="channel-title-row">
          <div><span className="section-kicker">公开来源</span><h1>渠道目录</h1><p className="listing-lead">列出已识别来源的采集状态。健康表示数据连接状态，不是商家信用背书。</p></div>
          <dl className="channel-stats"><div><dt>已收录来源</dt><dd>{allChannels.length}</dd></div><div><dt>启用中</dt><dd>{allChannels.filter((channel) => channel.enabled).length}</dd></div><div><dt>近期成功</dt><dd>{allChannels.filter((channel) => channel.lastSuccessAt).length}</dd></div></dl>
        </div>
        <aside className="guide-strip"><div><span>重要说明</span><b>采集健康不等于商家可靠</b></div><p>它只说明公开数据连接是否正常。交易前仍需回原站核对商品、售后和投诉入口。</p><Link href="/methodology">查看责任边界</Link></aside>
        <nav className="view-switch standalone" aria-label="订阅频道视图"><Link href="/subscriptions">标准商品</Link><Link className="active" href="/channels">卡网商家</Link><Link href="/submit">申请收录</Link></nav>
        <form className="channel-filter-form" action="/channels">
          <label className="sr-only" htmlFor="channel-query">搜索渠道</label>
          <input id="channel-query" name="q" defaultValue={q} placeholder="搜索商家、采集方式或网址…" />
          <label><span>连接状态</span><select name="health" defaultValue={health}><option value="">全部</option>{healthOptions.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <label><span>排序</span><select name="sort" defaultValue={sort}><option value="recent">最近成功</option><option value="products">商品数</option><option value="name">名称</option></select></label>
          <label className="check-filter"><input name="enabled" type="checkbox" value="yes" defaultChecked={enabledOnly} /><span>仅看启用来源</span></label>
          <button type="submit">应用</button>
        </form>
        <div className="catalog-status"><span>{channels.length} 个匹配渠道</span><span>状态来自公开采集任务</span>{hasFilters ? <Link href="/channels">清空全部条件</Link> : <span>可按名称与连接状态筛选</span>}</div>
        {channels.length ? <div className="channel-grid">{channels.map((channel) => <article key={channel.sourceId}><div className="review-facts"><span>{channel.collectorKind}</span><span>{channel.healthStatus}</span><span>{channel.enabled ? "已启用" : "未公开"}</span></div><h2><Link href={`/merchants/${channel.merchantSlug}`}>{channel.merchantName}</Link></h2><dl><div><dt>商品数</dt><dd>{channel.expectedProductCount ?? "—"}</dd></div><div><dt>最后成功</dt><dd>{date(channel.lastSuccessAt)}</dd></div><div><dt>首次发现</dt><dd>{date(channel.firstSeenAt)}</dd></div></dl><a href={channel.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">原站 ↗</a></article>)}</div> : <div className="empty-state">没有匹配渠道，请调整筛选条件。</div>}
      </section>
    </main>
  );
}
