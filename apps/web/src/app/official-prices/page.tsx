import { getOfficialSubscriptionPrices } from "@/lib/public-pricing";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

const channelNames: Record<string, string> = { web: "官网", app_store: "App Store", google_play: "Google Play" };
const periodNames: Record<string, string> = { month: "月", year: "年", one_time: "次" };

function priceText(row: Awaited<ReturnType<typeof getOfficialSubscriptionPrices>>[number]): string {
  if (row.priceKind === "exact" && row.amount) return `${row.currency} ${Number(row.amount).toFixed(2)}`;
  if (row.priceKind === "range" && row.lowerAmount && row.upperAmount) return `${row.currency} ${Number(row.lowerAmount).toFixed(2)}–${Number(row.upperAmount).toFixed(2)}`;
  return "未公开精确 SKU 价";
}

export default async function OfficialPricesPage() {
  const prices = await getOfficialSubscriptionPrices();
  const vendors = new Map<string, typeof prices>();
  for (const row of prices) vendors.set(row.vendor, [...(vendors.get(row.vendor) ?? []), row]);
  return <main><SiteHeader active="official" />
    <section className="listing-shell pricing-shell">
      <span className="section-kicker">Official subscription</span><h1>官方订阅地区价</h1>
      <p className="listing-lead">同时保留官网、App Store 和 Google Play 的原币证据。只有“精确价 + 同一套餐 + 同一计费周期”才参与地区最低价；公开商店只显示区间时会明确标注。</p>
      <div className="evidence-banner"><b>证据级别</b><span>精确价可比较 · 区间价仅参考 · 未知价不排名</span></div>
      {[...vendors.entries()].map(([vendor, rows]) => <section className="price-vendor" key={vendor}>
        <div className="section-heading"><div><span className="section-kicker">{vendor}</span><h2>{rows[0]?.planName.split(" ")[0] ?? vendor} 官方价格</h2></div><span className="section-note">{rows.length} 条当前观测</span></div>
        <div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th>套餐</th><th>渠道 / 地区</th><th>原币价</th><th>人民币估算</th><th>精度</th><th>核验</th></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}><td><b>{row.planName}</b><small>{row.rawPlanName} · /{periodNames[row.billingPeriod] ?? row.billingPeriod}</small></td><td>{channelNames[row.channel] ?? row.channel} · {row.countryCode}{row.appId ? <small>ID {row.appId}</small> : null}</td><td><strong>{priceText(row)}</strong></td><td>{row.cnyEstimate ? `¥${Number(row.cnyEstimate).toFixed(2)}` : "—"}{row.exchangeRateDate ? <small>汇率 {row.exchangeRateDate}</small> : null}</td><td><span className={`quality-pill ${row.priceKind}`}>{row.priceKind === "exact" ? "精确" : row.priceKind === "range" ? "区间" : "未知"}</span></td><td><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">官方证据 ↗</a><small>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium" }).format(row.verifiedAt)} · {row.historyCount} 版</small></td></tr>)}
        </tbody></table></div>
      </section>)}
      {!prices.length && <div className="empty-state">尚未生成官方价格快照，请先运行 Worker 刷新任务。</div>}
    </section>
  </main>;
}
