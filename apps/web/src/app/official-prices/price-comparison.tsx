import Link from "next/link";
import { OFFICIAL_SUBSCRIPTION_PLAN_CATALOG as catalog, OFFICIAL_SUBSCRIPTION_REGION_CATALOG as regionCatalog } from "@price-radar/price-channels/subscription-catalog";
import { regionDisplayName } from "@price-radar/price-channels/storefront-catalog";
import { isFreshOfficialSubscriptionPrice, hasCurrentCnyEstimate, getOfficialSubscriptionPriceStatus, hasVerifiedSubscriptionBilling, type OfficialSubscriptionPrice as Price, type OfficialSubscriptionCheck as Check } from "@/lib/public-pricing";
import styles from "./price-comparison.module.css";

const vendors: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", google: "Gemini", xai: "Grok" };
const channels: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const periods: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
const statuses: Record<string, string> = { price_anomaly: "源站金额异常 · 待核验", fetch_failed: "来源暂不可读", regional_checkout_required: "需登录或应用商店核验", price_not_public: "未公开精确价", ambiguous_sku: "套餐周期待核验", billing_unverified: "公开内购金额 · 周期待核验", sku_not_listed: "公开列表未列出", not_available: "来源未提供地区页面", storefront_redirected: "商店重定向 · 未采集", country_fallback: "页面回落到其他地区 · 未采集", currency_mismatch: "币种不一致 · 未入库", currency_unknown: "币种无法确认 · 未入库", parser_drift: "页面结构变化 · 待修复", range_only: "仅公开价格区间" };
const billingMethods: Record<string, string> = { explicit_sku_name: "内购名称明示周期", official_plan_document: "标准套餐周期依据（未验证账户结算）", same_country_vendor_page_match: "与同国官网金额一致（不能单独证明周期）", official_page_explicit_period: "官网页面明示按月", official_checkout_config_interval: "官网结算配置明示按月" };
const taxLabels: Record<string, string> = { inclusive: "标价含税", exclusive: "标价不含税", checkout_required: "税费以结算页为准" };
type Params = Record<string, string | string[] | undefined>;
const first = (value: Params[string]) => (Array.isArray(value) ? value[0] : value) ?? "";
const amount = (value: string | number) => Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keyOf = (row: { vendor: string; planCode: string; channel: string; countryCode: string }) => `${row.vendor}:${row.planCode}:${row.channel}:${row.countryCode}`;
const newest = (rows: Price[]) => [...rows].sort((a, b) => b.verifiedAt.getTime() - a.verifiedAt.getTime())[0];
const date = (value: Date) => value.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });

function Cell({ row, check, monthly, lowest }: { row: Price | undefined; check: Check | undefined; monthly: boolean; lowest: boolean }) {
  const exact = row?.priceKind === "exact" && row.amount !== null && check?.status !== "price_anomaly";
  const announcement = row?.evidenceUrl.includes("/introducing-chatgpt-go/");
  const divisor = monthly && row?.billingPeriod === "year" && hasVerifiedSubscriptionBilling(row) ? 12 : 1;
  const state = exact && row ? getOfficialSubscriptionPriceStatus(row) : statuses[check?.status ?? ""] ?? "尚未取得报价";
  return <div className={`${styles.quote}${lowest ? ` ${styles.lowest}` : ""}`}>
    {exact && row ? <><span className={styles.original}>{row.currency} {amount(Number(row.amount) / divisor)}{divisor === 12 && <small> / 月</small>}</span><strong>{row.cnyEstimate !== null ? `≈ ¥${amount(Number(row.cnyEstimate) / divisor)}` : "汇率待补"}</strong>{divisor === 12 && <small>年付总额 {row.currency} {amount(row.amount!)}</small>}</> : <span className={styles.missing}>{state}</span>}
    {exact && state && <em className={styles.state}>{state}</em>}
    {lowest && <em className={styles.best}>同渠道标价折算较低</em>}
    {exact && row && !hasVerifiedSubscriptionBilling(row) && <small>此金额尚不能认作目录所示周期的应付价</small>}
    <details className={styles.evidence}><summary>{exact ? "来源与核验" : "查看原因"}</summary>
      {row && <><p>{announcement ? "公告日期" : "价格核验"}：<time dateTime={row.verifiedAt.toISOString()}>{date(row.verifiedAt)}</time></p><p>原始内购名称：{row.rawPlanName}</p><a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">价格来源 ↗</a>{row.exchangeRateDate && row.exchangeRateUrl && <p><a href={row.exchangeRateUrl} target="_blank" rel="noopener noreferrer nofollow">汇率日期 {row.exchangeRateDate} ↗</a></p>}</>}
      {typeof row?.evidence?.billingEvidenceUrl === "string" && <p><a href={row.evidence.billingEvidenceUrl} target="_blank" rel="noopener noreferrer nofollow">{billingMethods[String(row.evidence.billingEvidenceMethod)] ?? "计费周期依据"} ↗</a></p>}
      {typeof row?.evidence?.taxTreatment === "string" && taxLabels[row.evidence.taxTreatment] && <p>{taxLabels[row.evidence.taxTreatment]}</p>}
      {row?.evidence?.rolloutGated === true && <p>本币定价处于灰度，部分用户仍可能看到美元或欧元价</p>}
      {Array.isArray(row?.evidence?.duplicateOf) && row.evidence.duplicateOf.length > 0 && <p>同名候选金额与 {row.evidence.duplicateOf.join("、")} 相同，尚不能确认是重复项</p>}
      {row?.evidence?.resolvedBy === "vendor_monthly_amount" && Array.isArray(row.evidence.listedAmounts) && <p>同名内购项列出 {row.evidence.listedAmounts.map(String).join(" / ")}，旧记录曾按同国官网金额选择，现已撤回此周期推断</p>}
      {check?.status === "range_only" && typeof check.evidence?.lowerText === "string" && <p>应用内购买区间：{String(check.evidence.lowerText)} – {String(check.evidence.upperText ?? "")}</p>}
      {check ? <><p>{check.reason}</p><p>采集检查：{date(check.checkedAt)}</p><a href={check.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">查看被检查的官方页面 ↗</a></> : <p>没有本地区、套餐与渠道的采集检查记录；不代表免费或不能购买。</p>}
    </details>
  </div>;
}

export function PriceComparison({ rows, checks, params, available }: { rows: Price[]; checks: Check[] | null; params: Params; available: boolean }) {
  const requestedVendor = first(params.compare_vendor), requestedPeriod = first(params.compare_period), requestedChannel = first(params.compare_channel), requestedRegion = first(params.compare_region);
  const vendor = vendors[requestedVendor] ? requestedVendor : "";
  const period = ["month", "year"].includes(requestedPeriod) ? requestedPeriod : "";
  const channel = channels[requestedChannel] ? requestedChannel : "";
  const monthly = first(params.compare_basis) === "month";
  const freshOnly = first(params.compare_fresh) === "1";
  const otherCodes = [...new Set(rows.map(row => row.countryCode))].filter(code => !regionCatalog.some(item => item.countryCode === code));
  const regions = [...regionCatalog.map(item => ({ code: item.countryCode, name: item.displayName })), ...otherCodes.map(code => ({ code, name: regionDisplayName(code) })).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))];
  const region = regions.some(item => item.code === requestedRegion) ? requestedRegion : "";
  const visibleRegions = regions.filter(item => !region || item.code === region);
  const plans = catalog.filter(plan => (!vendor || plan.vendor === vendor) && (!period || plan.billingPeriod === period));
  const selectedChannels = Object.keys(channels).filter(value => !channel || channel === value);
  const checkIndex = new Map((checks ?? []).map(check => [keyOf(check), check]));
  const index = new Map<string, Price[]>();
  for (const row of rows) { const key = keyOf(row); index.set(key, [...(index.get(key) ?? []), row]); }
  const groups = plans.flatMap(plan => selectedChannels.map(channel => {
    const cells = visibleRegions.map(region => {
      const key = keyOf({ ...plan, channel, countryCode: region.code });
      return { region, row: newest(index.get(key) ?? []), check: checkIndex.get(key) };
    });
    const comparable = cells.flatMap(cell => cell.row && cell.row.priceKind === "exact" && hasCurrentCnyEstimate(cell.row) && isFreshOfficialSubscriptionPrice(cell.row) ? [Number(cell.row.cnyEstimate)] : []);
    return { plan, channel, cells, minimum: comparable.length > 1 ? Math.min(...comparable) : null };
  })).filter(group => !freshOnly || group.cells.some(cell => cell.row && isFreshOfficialSubscriptionPrice(cell.row) && cell.row.priceKind === "exact"));
  const total = plans.length * selectedChannels.length * visibleRegions.length;
  const allCells = plans.flatMap(plan => selectedChannels.flatMap(channel => visibleRegions.map(region => newest(index.get(keyOf({ ...plan, channel, countryCode: region.code })) ?? []))));
  const current = allCells.filter(row => row?.priceKind === "exact" && isFreshOfficialSubscriptionPrice(row)).length;
  const historical = allCells.filter(row => row?.priceKind === "exact" && !isFreshOfficialSubscriptionPrice(row)).length;
  return <section id="price-comparison" className={styles.section} aria-labelledby="comparison-heading">
    <header className={styles.heading}><div><p className="priceai-kicker">各 AI · 各档位 · 各地区</p><h2 id="comparison-heading">订阅价格对照表</h2><p>一行一个套餐与购买渠道，横向比较地区。原币金额在上，人民币估算在下。</p></div><Link href="/official-prices/regions">单套餐详情 ↗</Link></header>
    <form action="/official-prices#price-comparison" className={styles.filters}>
      {["q", "vendor", "channel", "period"].map(key => first(params[key]) ? <input key={key} type="hidden" name={key} value={first(params[key])} /> : null)}
      <label htmlFor="compare-vendor">AI 产品<select id="compare-vendor" name="compare_vendor" defaultValue={vendor}><option value="">全部 AI</option>{Object.entries(vendors).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="compare-period">付费周期<select id="compare-period" name="compare_period" defaultValue={period}><option value="">全部周期</option><option value="month">月付</option><option value="year">年付</option></select></label>
      <label htmlFor="compare-channel">购买渠道<select id="compare-channel" name="compare_channel" defaultValue={channel}><option value="">全部渠道</option>{Object.entries(channels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="compare-region">地区<select id="compare-region" name="compare_region" defaultValue={region}><option value="">全部地区</option>{regions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label htmlFor="compare-basis">金额口径<select id="compare-basis" name="compare_basis" defaultValue={monthly ? "month" : "cycle"}><option value="cycle">每期总价</option><option value="month">每月折算</option></select></label>
      <label className={styles.checkbox}><input type="checkbox" name="compare_fresh" value="1" defaultChecked={freshOnly} />只看周期明确且近期核验的行</label>
      <button type="submit">更新对照表</button><Link href="/official-prices#price-comparison">重置</Link>
    </form>
    <div className={styles.coverage} role="status"><b>{current} / {total} 项周期明确且近期核验</b><span>{historical} 项为历史或待核验金额</span><span>{total - current - historical} 项尚无精确价</span></div>
    <p className={styles.meta}>{plans.length} 个目录套餐 · {visibleRegions.length} 个地区 · {groups.length} 行<span>仅比较同套餐同渠道的公开标价折算，未统一税费与购买资格</span></p>
    {checks === null && <p role="status">采集状态暂不可用，已保存的价格仍可查看。</p>}
    {!available ? <p role="status">暂时无法读取价格数据，请稍后刷新重试。</p> : !groups.length ? <p role="status">当前条件下没有新核验报价，请取消勾选或重置筛选。</p> : <div className={styles.scroll} tabIndex={0} role="region" aria-label="订阅价格对照表，可左右滚动">
      <table className={styles.table}>
        <caption className="sr-only">每行一个套餐与渠道，每列一个地区，同时保留原币及人民币价格</caption>
        <thead><tr><th scope="col" className={styles.identity}>AI / 套餐 / 渠道</th>{visibleRegions.map(item => <th scope="col" key={item.code}>{item.name}<small>{item.code}</small></th>)}</tr></thead>
        <tbody>{groups.map(({ plan, channel, cells, minimum }, index) => <tr key={`${plan.planCode}:${channel}`} className={index === 0 || groups[index - 1]?.plan.planCode !== plan.planCode ? styles.groupStart : undefined}>
          <th scope="row" className={styles.identity}><span className={styles.vendor}>{vendors[plan.vendor]}</span><Link href={`/official-prices/regions?plan=${encodeURIComponent(plan.planCode)}`}>{plan.displayName}</Link><small>{periods[plan.billingPeriod]}{plan.billingPeriod === "year" ? " · 整年扣款" : ""}</small><span className={styles.channel}>{channels[channel]}</span></th>
          {cells.map(({ region, row, check }) => <td key={region.code}><Cell row={row} check={check} monthly={monthly} lowest={Boolean(row && visibleRegions.length > 1 && isFreshOfficialSubscriptionPrice(row) && hasCurrentCnyEstimate(row) && minimum !== null && Number(row.cnyEstimate) === minimum)} /></td>)}
        </tr>)}</tbody>
      </table>
    </div>}
    <p className={styles.note}>年付“每月折算”仅用于预算比较，付款仍收取整年费用。人民币金额使用记录对应的汇率，未另加税费和跨境支付费；“公告参考价”及待核验记录不参与较低价标记。缺少价格不代表该地区或渠道不支持订阅，购买资格请在官方结算页确认。</p>
  </section>;
}
