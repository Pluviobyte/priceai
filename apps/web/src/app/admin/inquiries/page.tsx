import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getRecentSiteInquiries, INQUIRY_KINDS } from "@/lib/site-inquiries";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminInquiriesPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const inquiries = await getRecentSiteInquiries();
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="section-kicker">公开表单</span><h1>反馈与合作</h1></div>
        <AdminNav />
      </header>
      <div className="review-list">
        {inquiries.length === 0 ? <div className="empty-state">暂无留言。</div> : inquiries.map((inquiry) => (
          <article className="review-card" key={inquiry.id}>
            <div className="review-facts">
              <span>{INQUIRY_KINDS[inquiry.kind as keyof typeof INQUIRY_KINDS] ?? inquiry.kind}</span>
              <span>{inquiry.createdAt.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</span>
            </div>
            <h3>{inquiry.name ?? "未留称呼"}</h3>
            <p><b>联系：</b>{inquiry.contact}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{inquiry.message}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
