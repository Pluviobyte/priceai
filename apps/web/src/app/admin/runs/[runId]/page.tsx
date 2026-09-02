import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminRun } from "@/lib/admin-data";
import { AdminNav } from "../../admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const { runId } = await params;
  const run = await getAdminRun(runId);
  if (!run) redirect("/admin/sources");
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <span className="section-kicker">采集证据</span>
          <h1>{run.merchantName}</h1>
        </div>
        <AdminNav />
      </header>
      <section className="run-summary">
        <article><span>状态</span><b>{run.status}</b></article>
        <article><span>完整快照</span><b>{run.completeSnapshot ? "是" : "否"}</b></article>
        <article><span>抓取/解析</span><b>{run.fetchedTotal}/{run.parsedTotal}</b></article>
        <article><span>重复</span><b>{run.duplicateTotal}</b></article>
        <article><span>采集器</span><b>{run.collectorKind} {run.collectorVersion}</b></article>
      </section>
      {run.errorMessage ? <div className="form-error">{run.errorCode}: {run.errorMessage}</div> : null}
      <section className="run-table-wrap">
        <table className="run-table">
          <thead><tr><th>商品</th><th>价格</th><th>库存</th><th>状态</th><th>证据</th></tr></thead>
          <tbody>
            {run.samples.map((sample) => (
              <tr key={sample.sourceItemId}>
                <td>{sample.title}</td>
                <td>{sample.price ? `${sample.currency} ${Number(sample.price).toFixed(2)}` : "—"}</td>
                <td>{sample.stockCount ?? "—"}</td>
                <td>{sample.stockState}</td>
                <td><a href={sample.productUrl} target="_blank" rel="noopener noreferrer nofollow">原站 ↗</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
