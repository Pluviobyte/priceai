import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminDiscoveryCandidates } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";
export default async function DiscoveryPage() {
  if (!(await isAdminAuthenticated(["system_admin", "operations"]))) redirect("/admin/login");
  const candidates = await getAdminDiscoveryCandidates();
  return <main className="admin-shell"><header className="admin-header"><div><span className="section-kicker">Grok / 搜索 / 聚合站</span><h1>来源发现候选</h1></div><AdminNav /></header><div className="review-list">
    {candidates.length === 0 ? <div className="empty-state">暂无待处理候选。</div> : candidates.map((candidate) => <article className="review-card" key={candidate.id}><div className="review-facts"><span>{candidate.discoveryKind}</span><span>{candidate.status}</span><time>{candidate.discoveredAt.toLocaleString("zh-CN")}</time></div><h3>{candidate.merchantNameHint ?? "未命名候选"}</h3><a className="submission-url" href={candidate.candidateUrl} target="_blank" rel="noopener noreferrer nofollow">{candidate.candidateUrl}</a>{candidate.discoveryUrl ? <p>发现证据：<a href={candidate.discoveryUrl}>{candidate.discoveryUrl}</a></p> : null}<form action={`/api/admin/discovery/${candidate.id}`} method="post" className="anomaly-form"><input name="reason" minLength={2} maxLength={500} required placeholder="审核依据" /><button name="action" value="precheck">转入安全预检</button><button name="action" value="adapter">进入专站适配队列</button><button className="danger" name="action" value="reject">拒绝</button></form></article>)}
  </div></main>;
}
