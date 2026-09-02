import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminSources } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

function formatTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(value);
}

export default async function AdminSourcesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const sources = await getAdminSources();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="section-kicker">采集控制面</span>
          <h1>来源与运行</h1>
        </div>
        <AdminNav />
      </header>
      <div className="source-list">
        {sources.map((source) => (
          <article className="source-card" key={source.id}>
            <div className="source-card-main">
              <div className="review-facts">
                <span>{source.collectorKind}</span>
                <span className={`health-${source.healthStatus}`}>{source.healthStatus}</span>
                <span>{source.enabled ? "已启用" : "已暂停"}</span>
              </div>
              <h2>{source.merchantName}</h2>
              <a href={source.canonicalEntryUrl} target="_blank" rel="noopener noreferrer nofollow">
                {source.canonicalEntryUrl}
              </a>
            </div>
            <dl className="source-metrics">
              <div><dt>商品数</dt><dd>{source.expectedProductCount ?? "—"}</dd></div>
              <div><dt>连续失败</dt><dd>{source.consecutiveFailures}</dd></div>
              <div><dt>最后成功</dt><dd>{formatTime(source.lastSuccessAt)}</dd></div>
              <div><dt>下次运行</dt><dd>{formatTime(source.nextRunAt)}</dd></div>
            </dl>
            <div className="source-run">
              {source.lastRunId ? (
                <a href={`/admin/runs/${source.lastRunId}`}>
                  最近运行：{source.lastRunStatus} · {source.lastRunFetched ?? 0} 条
                </a>
              ) : <span>尚无运行</span>}
              {source.lastRunError ? <small>{source.lastRunError}</small> : null}
            </div>
            <form action={`/api/admin/sources/${source.id}`} method="post" className="source-actions">
              <input type="hidden" name="reason" value="管理员在来源工作台执行操作" />
              {source.enabled ? (
                <button name="action" value="pause" type="submit">暂停</button>
              ) : (
                <button name="action" value="enable" type="submit">启用</button>
              )}
              <button name="action" value="retry" type="submit">立即重抓</button>
              <select name="collectorKind" defaultValue={source.collectorKind} aria-label="采集器"><option value="shop_api">Shop API</option><option value="kami">Kami</option><option value="dujiao">独角数卡</option><option value="public_json">通用 JSON</option><option value="merchant_feed">商家 Feed</option><option value="generic_html">通用 HTML</option><option value="browser">浏览器兜底</option></select>
              <button name="action" value="switch" type="submit">切换采集器</button>
              <button className="danger" name="action" value="remove" type="submit">标记移除</button>
            </form>
          </article>
        ))}
      </div>
    </main>
  );
}
