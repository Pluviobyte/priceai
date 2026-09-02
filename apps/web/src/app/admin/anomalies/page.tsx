import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminAnomalies } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminAnomaliesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const anomalies = await getAdminAnomalies();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="section-kicker">质量门禁</span>
          <h1>异常队列</h1>
        </div>
        <AdminNav />
      </header>
      <div className="review-list">
        {anomalies.map((anomaly) => (
          <article className="review-card" key={anomaly.id}>
            <div className="review-facts">
              <span>{anomaly.sourceName}</span>
              <span>{anomaly.kind}</span>
              <span>{anomaly.severity}</span>
            </div>
            <h3>{anomaly.title}</h3>
            <pre className="anomaly-values">{JSON.stringify({ observed: anomaly.observedValue, baseline: anomaly.baselineValue }, null, 2)}</pre>
            <form action={`/api/admin/anomalies/${anomaly.id}`} method="post" className="anomaly-form">
              <input name="reason" minLength={2} placeholder="处置说明" required />
              <button name="action" value="resolve" type="submit">标记已解决</button>
              <button name="action" value="ignore" type="submit">忽略此异常</button>
            </form>
          </article>
        ))}
      </div>
    </main>
  );
}
