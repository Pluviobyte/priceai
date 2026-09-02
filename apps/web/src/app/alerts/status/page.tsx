import { getAlertStatus } from "@/lib/public-alerts";
import { SiteHeader } from "../../site-header";

export const dynamic = "force-dynamic";

export default async function AlertStatusPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  const valid = id && /^[0-9a-f-]{36}$/i.test(id) ? await getAlertStatus(id) : null;
  return <main><SiteHeader /><section className="status-shell"><span className="section-kicker">提醒状态</span><h1>{valid?.status === "active" ? "提醒已启用" : "请检查邮箱完成确认"}</h1><p>{valid ? `类型：${valid.alertType === "price_drop" ? "降价提醒" : "补货提醒"}。通知发送失败时会由 Outbox 保留并重试。` : "未找到这条提醒。"}</p></section></main>;
}
