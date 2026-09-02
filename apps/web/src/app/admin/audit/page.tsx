import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminAuditLog } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";
export default async function AuditPage() {
  if (!(await isAdminAuthenticated(["system_admin"]))) redirect("/admin/login");
  const rows = await getAdminAuditLog();
  return <main className="admin-shell"><header className="admin-header"><div><span className="section-kicker">Append-only evidence</span><h1>人工操作审计</h1></div><AdminNav /></header><div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>目标</th><th>原因</th><th>前后值</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "short", timeStyle: "medium" }).format(row.created_at)}</td><td>{row.actor_id}</td><td>{row.action}</td><td>{row.target_type}<small>{row.target_id}</small></td><td>{row.reason}</td><td><details><summary>查看 JSON</summary><pre>{JSON.stringify({ before: row.before_value, after: row.after_value }, null, 2)}</pre></details></td></tr>)}</tbody></table></div></main>;
}
