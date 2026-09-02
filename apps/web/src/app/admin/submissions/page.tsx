import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminSubmissions } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminSubmissionsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const submissions = await getAdminSubmissions();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="section-kicker">准入流程</span><h1>渠道投稿</h1></div>
        <AdminNav />
      </header>
      <div className="review-list">
        {submissions.length === 0 ? <div className="empty-state">暂无投稿。</div> : submissions.map((submission) => (
          <article className="review-card" key={submission.id}>
            <div className="review-facts">
              <span>{submission.status}</span>
              <span>{submission.detectedCollectorKind ?? "未识别系统"}</span>
              {submission.trialRunId ? <a href={`/admin/runs/${submission.trialRunId}`}>查看试采运行</a> : null}
            </div>
            <h3>{submission.name ?? "未命名店铺"}</h3>
            <a className="submission-url" href={submission.url} target="_blank" rel="noopener noreferrer nofollow">{submission.url}</a>
            {submission.primaryProducts ? <p><b>主营：</b>{submission.primaryProducts}</p> : null}
            {submission.contact ? <p><b>联系：</b>{submission.contact}</p> : null}
            {submission.notes ? <p><b>备注：</b>{submission.notes}</p> : null}
            <details><summary>自动预检结果</summary><pre className="anomaly-values">{JSON.stringify(submission.precheckResult, null, 2)}</pre></details>
            <form action={`/api/admin/submissions/${submission.id}`} method="post" className="anomaly-form">
              <input name="reason" minLength={2} placeholder="审核或重试原因" required />
              <button name="action" value="retry" type="submit">重新预检</button>
              <button name="action" value="approve" type="submit">通过并启用</button>
              <button className="danger" name="action" value="reject" type="submit">拒绝</button>
            </form>
          </article>
        ))}
      </div>
    </main>
  );
}
