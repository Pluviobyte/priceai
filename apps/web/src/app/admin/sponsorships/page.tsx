import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminSponsorships } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

export default async function SponsorshipsPage() {
  if (!(await isAdminAuthenticated(["system_admin", "operations"]))) redirect("/admin/login");
  const rows = await getAdminSponsorships();
  return <main className="admin-shell"><header className="admin-header"><div><span className="section-kicker">Commercial disclosure</span><h1>广告与赞助</h1></div><AdminNav /></header>
    <form className="public-form admin-create-form" action="/api/admin/sponsorships" method="post"><label>名称<input name="name" minLength={2} maxLength={120} required /></label><label>位置<select name="position"><option value="home_after_hero">首页 Hero 之后</option><option value="product_sidebar">商品侧边栏</option></select></label><label>显示标签<input name="label" defaultValue="赞助" maxLength={30} required /></label><label>目标 URL<input name="destinationUrl" type="url" maxLength={500} required /></label><label>素材 URL<input name="imageUrl" type="url" maxLength={500} /></label><label>商业关系披露<textarea name="disclosure" minLength={4} maxLength={500} required /></label><label>开始<input name="startsAt" type="datetime-local" required /></label><label>结束<input name="endsAt" type="datetime-local" required /></label><label>状态<select name="status"><option value="draft">草稿</option><option value="active">启用</option><option value="paused">暂停</option></select></label><button type="submit">创建并记录审计</button></form>
    <div className="review-list">{rows.map((row) => <article className="review-card" key={row.id}><div className="review-facts"><span>{row.status}</span><span>{row.position}</span><span>{row.label}</span></div><h3>{row.name}</h3><p>{row.disclosure}</p><a className="submission-url" href={row.destinationUrl} target="_blank" rel="noopener noreferrer nofollow">{row.destinationUrl}</a><form className="anomaly-form" action="/api/admin/sponsorships" method="post"><input type="hidden" name="id" value={row.id} /><input type="hidden" name="name" value={row.name} /><input type="hidden" name="position" value={row.position} /><input type="hidden" name="label" value={row.label} /><input type="hidden" name="destinationUrl" value={row.destinationUrl} /><input type="hidden" name="imageUrl" value={row.imageUrl ?? ""} /><input type="hidden" name="disclosure" value={row.disclosure} /><input type="hidden" name="startsAt" value={row.startsAt.toISOString()} /><input type="hidden" name="endsAt" value={row.endsAt.toISOString()} /><select name="status" defaultValue={row.status}><option value="active">启用</option><option value="paused">暂停</option><option value="archived">归档</option></select><button type="submit">更新状态</button></form></article>)}</div>
  </main>;
}
