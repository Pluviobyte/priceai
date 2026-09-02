import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminGenerations, getAdminPublicationRequests } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

function time(value: Date | null) { return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(value) : "—"; }

export default async function GenerationsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const [generations, requests] = await Promise.all([getAdminGenerations(), getAdminPublicationRequests()]);
  return <main className="admin-shell"><header className="admin-header"><div><span className="section-kicker">Atomic publication</span><h1>发布与回滚</h1></div><AdminNav /></header>
    <p className="listing-lead">每一代都保留独立报价快照。回滚会在单一数据库事务中恢复报价并切换 latest 指针。</p>
    <form className="anomaly-form" method="post" action="/api/admin/generations"><input name="reason" minLength={4} maxLength={500} required placeholder="发布原因" /><button type="submit">校验并请求新代发布</button></form>
    <div className="review-facts">{requests.slice(0, 5).map((request) => <span key={request.id}>发布请求 {request.status} · {request.requested_by} · {request.reason}{request.error_message ? ` · ${request.error_message}` : ""}</span>)}</div>
    <div className="review-list">{generations.map((generation) => <article className="review-card" key={generation.id}><div className="review-facts"><span>{generation.isCurrent ? "当前线上" : generation.status}</span><span>{time(generation.publishedAt)}</span><span>{generation.id}</span></div><h3>{generation.offerCount} 条报价 · {generation.productCount} 个产品 · {generation.sourceCount} 个来源</h3><div className="review-facts"><span>快照 {generation.snapshotCount}</span><span>新增 {generation.addedCount}</span><span>移除 {generation.removedCount}</span><span>变化 {generation.changedCount}</span><span>{generation.manifestHash ? `Manifest ${generation.manifestHash.slice(0, 12)}` : "尚无对象 Manifest"}</span></div>{!generation.isCurrent && generation.snapshotCount > 0 && <form className="anomaly-form" method="post" action={`/api/admin/generations/${generation.id}`}><input name="reason" minLength={4} maxLength={500} required placeholder="输入回滚原因" /><button className="danger" type="submit">回滚到该代</button></form>}</article>)}</div>
  </main>;
}
