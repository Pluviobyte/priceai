import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminAnnouncements, getAdminAnnouncementSettings } from "@/lib/admin-announcement-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

const kindLabels = { community: "社群", service: "服务", update: "更新" } as const;

export default async function AnnouncementsPage() {
  if (!(await isAdminAuthenticated(["system_admin", "operations"]))) redirect("/admin/login");
  const [rows, settings] = await Promise.all([getAdminAnnouncements(), getAdminAnnouncementSettings()]);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span className="section-kicker">Site messaging</span><h1>顶部横幅</h1></div>
        <AdminNav />
      </header>

      <section className="admin-announcement-settings">
        <div><h2>轮换设置</h2><p>同时启用多条公告时自动切换；停用后固定展示排序最靠前的一条。</p></div>
        <form action="/api/admin/announcements" method="post">
          <input type="hidden" name="intent" value="settings" />
          <label className="admin-check"><input name="rotationEnabled" type="checkbox" defaultChecked={settings.rotationEnabled} /><span>开启自动轮换</span></label>
          <label>切换间隔（秒）<input name="rotationIntervalSeconds" type="number" min="4" max="15" defaultValue={settings.rotationIntervalSeconds} required /></label>
          <button type="submit">保存轮换设置</button>
        </form>
      </section>

      <section className="admin-announcement-create">
        <div><span className="section-kicker">New message</span><h2>添加横幅内容</h2><p>启用后会自动加入顶部轮换；排序数字越小越靠前。</p></div>
        <form className="public-form admin-create-form" action="/api/admin/announcements" method="post">
          <input type="hidden" name="intent" value="announcement" />
          <label>标签<input name="badge" maxLength={20} placeholder="例如：新服务" required /></label>
          <label>主标题<input name="title" minLength={2} maxLength={80} placeholder="一句话说明新消息" required /></label>
          <label className="admin-field-wide">补充说明<input name="description" maxLength={120} placeholder="选填，桌面端展示" /></label>
          <label>按钮文字<input name="actionLabel" maxLength={20} placeholder="立即查看" required /></label>
          <label>跳转地址<input name="destinationUrl" maxLength={500} placeholder="/path 或 https://…" required /></label>
          <label>类型<select name="kind" defaultValue="update"><option value="community">社群</option><option value="service">服务</option><option value="update">更新</option></select></label>
          <label>状态<select name="status" defaultValue="active"><option value="active">启用</option><option value="paused">暂停</option><option value="archived">归档</option></select></label>
          <label>排序<input name="sortOrder" type="number" min="0" max="999" defaultValue="30" required /></label>
          <button className="admin-field-wide" type="submit">添加并启用</button>
        </form>
      </section>

      <section className="admin-announcement-list">
        <div className="admin-announcement-list-head"><h2>现有横幅</h2><span>{rows.filter((row) => row.status === "active").length} 条正在展示</span></div>
        <div className="review-list">
          {rows.map((row) => (
            <article className="review-card admin-announcement-card" key={row.id}>
              <div className="review-facts"><span>{row.status === "active" ? "正在展示" : row.status === "paused" ? "已暂停" : "已归档"}</span><span>{kindLabels[row.kind]}</span><span>排序 {row.sortOrder}</span></div>
              <div className="admin-announcement-preview"><small>{row.badge}</small><b>{row.title}</b>{row.description && <span>{row.description}</span>}<em>{row.actionLabel} →</em></div>
              <form className="admin-announcement-edit" action="/api/admin/announcements" method="post">
                <input type="hidden" name="intent" value="announcement" />
                <input type="hidden" name="id" value={row.id} />
                <label>标签<input name="badge" defaultValue={row.badge} maxLength={20} required /></label>
                <label>主标题<input name="title" defaultValue={row.title} minLength={2} maxLength={80} required /></label>
                <label className="admin-field-wide">补充说明<input name="description" defaultValue={row.description ?? ""} maxLength={120} /></label>
                <label>按钮文字<input name="actionLabel" defaultValue={row.actionLabel} maxLength={20} required /></label>
                <label>跳转地址<input name="destinationUrl" defaultValue={row.destinationUrl} maxLength={500} required /></label>
                <label>类型<select name="kind" defaultValue={row.kind}><option value="community">社群</option><option value="service">服务</option><option value="update">更新</option></select></label>
                <label>状态<select name="status" defaultValue={row.status}><option value="active">启用</option><option value="paused">暂停</option><option value="archived">归档</option></select></label>
                <label>排序<input name="sortOrder" type="number" min="0" max="999" defaultValue={row.sortOrder} required /></label>
                <button className="admin-field-wide" type="submit">保存这一条</button>
              </form>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
