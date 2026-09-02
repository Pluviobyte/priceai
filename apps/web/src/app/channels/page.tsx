import { getPublicChannels } from "@/lib/public-catalog";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

function date(value: Date | null): string { return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium" }).format(value) : "—"; }

export default async function ChannelsPage() {
  const channels = await getPublicChannels();
  return <main><SiteHeader active="channels" /><section className="listing-shell"><span className="section-kicker">公开来源</span><h1>渠道目录</h1><p className="listing-lead">列出已识别来源的采集状态。健康表示数据连接状态，不是商家信用背书。</p><div className="channel-grid">{channels.map((channel) => <article key={channel.sourceId}><div className="review-facts"><span>{channel.collectorKind}</span><span>{channel.healthStatus}</span><span>{channel.enabled ? "已启用" : "未公开"}</span></div><h2><a href={`/merchants/${channel.merchantSlug}`}>{channel.merchantName}</a></h2><dl><div><dt>商品数</dt><dd>{channel.expectedProductCount ?? "—"}</dd></div><div><dt>最后成功</dt><dd>{date(channel.lastSuccessAt)}</dd></div><div><dt>首次发现</dt><dd>{date(channel.firstSeenAt)}</dd></div></dl><a href={channel.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">原站 ↗</a></article>)}</div></section></main>;
}
