import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminDiscoveryCandidates, getAdminDiscoverySummary } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "待检测",
  vetting: "检测中",
  review: "待人工",
  approved: "已启用",
  rejected: "已拒绝",
  duplicate: "重复店铺",
  adapter_needed: "待适配器",
  blocked_egress: "出口被拦",
  submitted_for_precheck: "已转预检",
};

function formatTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(value);
}

export default async function DiscoveryPage() {
  if (!(await isAdminAuthenticated(["system_admin", "operations"]))) redirect("/admin/login");
  const [candidates, summary] = await Promise.all([getAdminDiscoveryCandidates(), getAdminDiscoverySummary()]);
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="section-kicker">目录 / 平台 / Grok / 搜索</span><h1>来源发现与自动检测</h1></div>
        <AdminNav />
      </header>
      <p className="review-facts">
        {summary.map((item) => <span key={item.status}>{STATUS_LABELS[item.status] ?? item.status} {item.count}</span>)}
      </p>
      <div className="review-list">
        {candidates.length === 0 ? <div className="empty-state">暂无待处理候选。目录导入和自动检测由 Worker 定时执行。</div> : candidates.map((candidate) => (
          <article className="review-card" key={candidate.id}>
            <div className="review-facts">
              <span>{STATUS_LABELS[candidate.status] ?? candidate.status}</span>
              <span>{candidate.platformKind ?? candidate.discoveryKind}{candidate.platformMerchantId ? ` · ${candidate.platformMerchantId}` : ""}</span>
              <span>被 {candidate.priority} 个目录收录</span>
              <time>{formatTime(candidate.discoveredAt)}</time>
            </div>
            <h3>{candidate.merchantNameHint ?? "未命名候选"}</h3>
            <a className="submission-url" href={candidate.candidateUrl} target="_blank" rel="noopener noreferrer nofollow">{candidate.candidateUrl}</a>
            {candidate.providers.length > 0 ? <p>发现来源：{candidate.providers.join("、")}</p> : null}
            {candidate.discoveryUrl ? <p>发现证据：<a href={candidate.discoveryUrl} target="_blank" rel="noopener noreferrer nofollow">{candidate.discoveryUrl}</a></p> : null}
            {candidate.verdict ? (
              <p>
                <b>自动检测：</b>{candidate.verdict}
                {candidate.reasons.length > 0 ? ` — ${candidate.reasons.join("；")}` : ""}
                {candidate.vettedAt ? ` · ${formatTime(candidate.vettedAt)}` : ""}
              </p>
            ) : null}
            {candidate.profile ? (
              <p>
                试采 {candidate.profile.itemCount} 件商品，AI 相关 {candidate.profile.aiRelevantCount} 件，有货 {candidate.profile.inStockCount} 件，无质保占比 {Math.round(candidate.profile.noWarrantyShare * 100)}%
                {candidate.profile.catalogOverlapMax !== null ? `，与已收录店铺最高重合 ${Math.round(candidate.profile.catalogOverlapMax * 100)}%` : ""}
              </p>
            ) : null}
            <p className="review-facts">
              {candidate.trialRunId ? <a href={`/admin/runs/${candidate.trialRunId}`}>查看试采运行</a> : null}
              {candidate.submissionId ? <a href="/admin/submissions">在渠道投稿中处理</a> : null}
              {candidate.sourceId ? <a href="/admin/sources">查看来源</a> : null}
              {candidate.nextVetAt ? <span>下次重检 {formatTime(candidate.nextVetAt)}</span> : null}
            </p>
            <form action={`/api/admin/discovery/${candidate.id}`} method="post" className="anomaly-form">
              <input name="reason" minLength={2} maxLength={500} required placeholder="审核依据" />
              {candidate.status === "review" || candidate.status === "adapter_needed" ? <button name="action" value="requeue">重新自动检测</button> : null}
              <button name="action" value="precheck">转入人工预检</button>
              <button name="action" value="adapter">进入专站适配队列</button>
              <button className="danger" name="action" value="reject">拒绝</button>
            </form>
          </article>
        ))}
      </div>
    </main>
  );
}
