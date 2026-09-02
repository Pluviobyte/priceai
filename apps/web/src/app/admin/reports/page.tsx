import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminReports } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminReportsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const reports = await getAdminReports();
  return <main className="admin-shell"><header className="admin-header"><div><span className="section-kicker">用户纠错</span><h1>举报处理</h1></div><AdminNav /></header><div className="review-list">{reports.length === 0 ? <div className="empty-state">当前没有待处理举报。</div> : reports.map((report) => <article className="review-card" key={report.id}><div className="review-facts"><span>{report.targetType}</span><span>{report.reportType}</span></div><h3>{report.targetLabel}</h3><p>{report.details}</p>{report.evidenceUrl ? <a className="submission-url" href={report.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">证据链接 ↗</a> : null}<form action={`/api/admin/reports/${report.id}`} method="post" className="anomaly-form"><input name="resolution" minLength={2} required placeholder="调查结果与处理依据" /><button name="action" value="resolve" type="submit">标记已解决</button><button name="action" value="dismiss" type="submit">证据不足</button><button className="danger" name="action" value="quarantine" type="submit">隔离目标</button></form></article>)}</div></main>;
}
