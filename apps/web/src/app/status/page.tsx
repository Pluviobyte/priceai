import { getPublicHealth } from "@/lib/public-platform";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

function percent(value: number | null): string { return value === null ? "样本不足" : `${(value * 100).toFixed(1)}%`; }
function date(value: Date | null): string { return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "medium" }).format(value) : "—"; }

export default async function StatusPage() {
  const health = await getPublicHealth();
  return <main><SiteHeader active="status" /><section className="listing-shell"><span className="section-kicker">公开运行指标</span><h1>数据健康</h1><p className="listing-lead">这里衡量的是采集与发布系统，不是商家信用评分。没有样本时不会伪造可用率。</p><div className="health-grid"><article><span>24 小时完整采集率</span><b>{percent(health.runSuccessRate)}</b><small>{health.successfulRuns24h} / {health.runs24h} 次</small></article><article><span>当前报价陈旧率</span><b>{percent(health.staleRate)}</b><small>{health.staleOfferCount} / {health.currentOfferCount} 条</small></article><article><span>健康来源</span><b>{health.healthySourceCount}</b><small>共 {health.sourceCount} 个来源</small></article><article><span>重试/失败来源</span><b>{health.failingSourceCount}</b><small>连续失败会自动退避</small></article><article><span>开放异常</span><b>{health.openAnomalyCount}</b><small>异常报价不争夺默认最低价</small></article><article><span>最近发布</span><b className="health-time">{date(health.publishedAt)}</b><small>代次 {health.generationId?.slice(0, 8) ?? "—"}</small></article></div><section className="api-docs"><h2>公共只读 API</h2><p>匿名请求默认每分钟 60 次，响应缓存 60 秒并允许 5 分钟陈旧回源。</p><code>GET /api/v1/products</code><code>GET /api/v1/products/:slug</code><code>GET /api/v1/channels</code><code>GET /api/v1/health</code></section></section></main>;
}
