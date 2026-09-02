import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { getAdminQualityReport } from "@/lib/admin-data";
import { AdminNav } from "../admin-nav";

export const dynamic = "force-dynamic";

export default async function QualityPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
  const { summary, merchants } = await getAdminQualityReport();
  const metric = (key: string) => Number(summary[key] ?? 0);
  const percent = (part: number, all: number) => all ? `${(part / all * 100).toFixed(1)}%` : "—";
  return <main className="admin-shell"><header className="admin-header"><div><span className="section-kicker">Data quality</span><h1>质量与覆盖</h1></div><AdminNav /></header>
    <div className="admin-summary"><article><b>{percent(metric("covered_product_count"), metric("product_count"))}</b><span>标准产品覆盖</span></article><article><b>{percent(metric("complete_runs_24h"), metric("runs_24h"))}</b><span>24 小时完整采集率</span></article><article><b>{percent(metric("failed_runs_24h"), metric("runs_24h"))}</b><span>24 小时失败率</span></article><article><b>{percent(metric("stale_offer_count"), metric("offer_count"))}</b><span>当前陈旧报价率</span></article><article><b>{percent(metric("open_anomaly_count"), metric("offer_count"))}</b><span>开放异常/报价</span></article><article><b>{percent(metric("reviewed_decisions") - metric("corrected_decisions"), metric("reviewed_decisions"))}</b><span>人工审核一致率</span></article><article><b>{metric("pending_review_count")}</b><span>待分类复核</span></article><article><b>{metric("duplicate_candidate_count")}</b><span>语义重复候选</span></article></div>
    <section className="review-section"><span className="section-kicker">Merchant exposure</span><h2>商家曝光聚合</h2><p className="listing-lead">只按商家和日期聚合点击，不展示或保存单次访客身份。</p><div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th>商家</th><th>报价</th><th>产品覆盖</th><th>30 天跳转</th><th>最后成功</th></tr></thead><tbody>{merchants.map((row) => <tr key={row.merchant_slug}><td><a href={`/merchants/${row.merchant_slug}`}>{row.merchant_name}</a></td><td>{row.offer_count}</td><td>{row.product_count}</td><td>{row.clicks_30d}</td><td>{row.last_success_at ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium" }).format(row.last_success_at) : "—"}</td></tr>)}</tbody></table></div></section>
  </main>;
}
