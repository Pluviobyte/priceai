import { officialPriceHref } from "@/lib/official-subscription-links";
import { OfficialSourceLink } from "./source-link";
import { comparisonPage } from "@/lib/comparison-pagination";
import Form from "next/form";
import Link from "next/link";
import { OFFICIAL_SUBSCRIPTION_PLAN_CATALOG as catalog, OFFICIAL_SUBSCRIPTION_REGION_CATALOG as regionCatalog } from "@price-radar/price-channels/subscription-catalog";
import { regionDisplayName } from "@price-radar/price-channels/storefront-catalog";
import { isFreshOfficialSubscriptionPrice, hasCurrentCnyEstimate, getOfficialSubscriptionPriceStatus, hasVerifiedSubscriptionBilling, type OfficialSubscriptionPrice as Price, type OfficialSubscriptionCheck as Check } from "@/lib/public-pricing";
import { ModelIcon, type ModelIconName } from "../model-icons";
import { ChannelIcon } from "../channel-icons";
import styles from "./price-comparison.module.css";

const vendors: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", google: "Gemini", xai: "Grok" };
const vendorIcons: Record<string, ModelIconName> = { openai: "openai", anthropic: "claude", google: "gemini", xai: "grok" };
const channels: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const periods: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
const statuses: Record<string, string> = { price_anomaly: "源站金额异常 · 待核验", fetch_failed: "来源暂不可读", regional_checkout_required: "需登录或应用商店核验", price_not_public: "未公开精确价", ambiguous_sku: "套餐周期待核验", billing_unverified: "公开内购金额 · 周期待核验", sku_not_listed: "公开列表未列出", not_available: "来源未提供地区页面", storefront_redirected: "商店重定向 · 未采集", country_fallback: "页面回落到其他地区 · 未采集", currency_mismatch: "币种不一致 · 未入库", currency_unknown: "币种无法确认 · 未入库", parser_drift: "页面结构变化 · 待修复", range_only: "仅公开价格区间" };
const billingMethods: Record<string, string> = { explicit_sku_name: "内购名称明示周期", official_plan_document: "标准套餐周期依据（未验证账户结算）", same_country_vendor_page_match: "与同国官网金额一致（不能单独证明周期）", official_page_explicit_period: "官网页面明示按月", official_checkout_config_interval: "官网结算配置明示按月" };
const taxLabels: Record<string, string> = { inclusive: "标价含税", exclusive: "标价不含税", checkout_required: "税费以结算页为准" };
type Params = Record<string, string | string[] | undefined>;
const first = (value: Params[string]) => (Array.isArray(value) ? value[0] : value) ?? "";
const amount = (value: string | number) => Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const keyOf = (row: { vendor: string; planCode: string; channel: string; countryCode: string }) => `${row.vendor}:${row.planCode}:${row.channel}:${row.countryCode}`;
const date = (value: Date) => value.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });

/**
 * Two prices for the same plan are not the same offer if they were read at different
 * stores, so the row states where it came from. Buying direct carries the vendor's own
 * mark; the two app stores carry theirs.
 */
function ChannelBadge({ channel, vendor }: { channel: string; vendor: string }) {
  const vendorIcon = vendorIcons[vendor];
  return <span className={styles.channel}>
    {channel === "app_store" ? <ChannelIcon name="apple" label="Apple" />
      : channel === "google_play" ? <ChannelIcon name="google" label="Google" />
        : vendorIcon ? <ModelIcon name={vendorIcon} label={vendors[vendor] ?? vendor} /> : null}
    {channels[channel] ?? channel}
  </span>;
}

function Cell({ row, check, monthly, lowest }: { row: Price | undefined; check: Check | undefined; monthly: boolean; lowest: boolean }) {
  const exact = row?.priceKind === "exact" && row.amount !== null && check?.status !== "price_anomaly";
  const announcement = row?.evidenceUrl.includes("/introducing-chatgpt-go/");
  const divisor = monthly && row?.billingPeriod === "year" && hasVerifiedSubscriptionBilling(row) ? 12 : 1;
  const state = exact && row ? getOfficialSubscriptionPriceStatus(row) : statuses[check?.status ?? ""] ?? "尚未取得报价";
  return <div className={`${styles.quote}${lowest ? ` ${styles.lowest}` : ""}`}>
    {exact && row ? <><span className={styles.original}>{row.currency} {amount(Number(row.amount) / divisor)}{divisor === 12 && <small> / 月</small>}</span><strong>{row.cnyEstimate !== null ? `≈ ¥${amount(Number(row.cnyEstimate) / divisor)}` : "汇率待补"}</strong>{divisor === 12 && <small>年付总额 {row.currency} {amount(row.amount!)}</small>}</> : <span className={styles.missing}>{state}</span>}
    {exact && state && <em className={styles.state}>{state}</em>}
    {lowest && <em className={styles.best}>同渠道跨地区标价折算较低</em>}
    {exact && row && !hasVerifiedSubscriptionBilling(row) && <small>此金额尚不能认作目录所示周期的应付价</small>}
    <details className={styles.evidence}><summary>{exact ? "来源与核验" : "查看原因"}</summary>
      {row && <><p>{announcement ? "公告日期" : "价格核验"}：<time dateTime={row.verifiedAt.toISOString()}>{date(row.verifiedAt)}</time></p><p>原始内购名称：{row.rawPlanName}</p><p><Link href={officialPriceHref(row)}>查看套餐详情与官方入口 ›</Link></p><OfficialSourceLink url={row.evidenceUrl} />{row.exchangeRateDate && row.exchangeRateUrl && <p><a href={row.exchangeRateUrl} target="_blank" rel="noopener noreferrer nofollow">汇率日期 {row.exchangeRateDate} ↗</a></p>}</>}
      {typeof row?.evidence?.billingEvidenceUrl === "string" && <div><OfficialSourceLink url={row.evidence.billingEvidenceUrl} label={billingMethods[String(row.evidence.billingEvidenceMethod)] ?? "计费周期依据"} /></div>}
      {typeof row?.evidence?.taxTreatment === "string" && taxLabels[row.evidence.taxTreatment] && <p>{taxLabels[row.evidence.taxTreatment]}</p>}
      {row?.evidence?.rolloutGated === true && <p>本币定价处于灰度，部分用户仍可能看到美元或欧元价</p>}
      {Array.isArray(row?.evidence?.duplicateOf) && row.evidence.duplicateOf.length > 0 && <p>同名候选金额与 {row.evidence.duplicateOf.join("、")} 相同，尚不能确认是重复项</p>}
      {row?.evidence?.resolvedBy === "vendor_monthly_amount" && Array.isArray(row.evidence.listedAmounts) && <p>同名内购项列出 {row.evidence.listedAmounts.map(String).join(" / ")}，旧记录曾按同国官网金额选择，现已撤回此周期推断</p>}
      {check?.status === "range_only" && typeof check.evidence?.lowerText === "string" && <p>应用内购买区间：{String(check.evidence.lowerText)} – {String(check.evidence.upperText ?? "")}</p>}
      {check ? <><p>{check.reason}</p><p>采集检查：{date(check.checkedAt)}</p><OfficialSourceLink url={check.evidenceUrl} label="被检查的官方页面" /></> : <p>没有本地区、套餐与渠道的采集检查记录；不代表免费或不能购买。</p>}
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
  const otherCodes = [...new Set([...rows.map(row => row.countryCode), ...(checks ?? []).map(check => check.countryCode)])].filter(code => !regionCatalog.some(item => item.countryCode === code));
  const regions = [...regionCatalog.map(item => ({ code: item.countryCode, name: item.displayName })), ...otherCodes.map(code => ({ code, name: regionDisplayName(code) })).sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))];
  const region = regions.some(item => item.code === requestedRegion) ? requestedRegion : "";
  const matchingRegions = regions.filter(item => !region || item.code === region);
  // Reading across regions is scrolling, not clicking: the table scrolls sideways and the
  // floor column stays pinned to the right edge. The pager underneath only reaches the tail.
  // Measured against production, one region column is ~35KB of markup (~1.2KB gzipped) —
  // streaming serialises every cell twice — so all 174 at once would be a 6.2MB document.
  // Thirty measures 1.12MB, 55KB gzipped, and turns 18 groups into 6.
  const pageSize = 30;
  const pageCount = Math.max(1, Math.ceil(matchingRegions.length / pageSize));
  const requestedPage = Number(first(params.compare_page));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, pageCount) : 1;
  const offset = (page - 1) * pageSize;
  const visibleRegions = matchingRegions.slice(offset, offset + pageSize);
  const pageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    for (const key of ["q", "vendor", "channel", "period", "compare_vendor", "compare_period", "compare_channel", "compare_region", "compare_basis", "compare_fresh", "compare_rows_page"]) {
      const value = first(params[key]);
      if (value) search.set(key, value);
    }
    if (nextPage > 1) search.set("compare_page", String(nextPage));
    return `/official-prices${search.size ? `?${search}` : ""}#price-comparison`;
  };
  const shown = Math.min(offset + pageSize, matchingRegions.length);
  const pagination = pageCount > 1 && <nav className={styles.pagination} aria-label="地区分页">
    {page > 1 ? <Link href={pageHref(page - 1)} prefetch={false}>← 回到前 {Math.min(pageSize, offset)} 个地区</Link> : <span />}
    <span>表格内左右拖动比较这 {visibleRegions.length} 个地区 · 已显示 {offset + 1}–{shown} / {matchingRegions.length}</span>
    {page < pageCount ? <Link href={pageHref(page + 1)} prefetch={false}>继续看后 {Math.min(pageSize, matchingRegions.length - shown)} 个地区 →</Link> : <span />}
  </nav>;
  const plans = catalog.filter(plan => plan.planCode !== "claude-pro-annual" && (!vendor || plan.vendor === vendor) && (!period || plan.billingPeriod === period));
  const selectedChannels = Object.keys(channels).filter(value => !channel || channel === value);
  const checkIndex = new Map((checks ?? []).map(check => [keyOf(check), check]));
  const index = new Map<string, Price>();
  for (const row of rows) {
    const key = keyOf(row), previous = index.get(key);
    if (!previous || row.verifiedAt > previous.verifiedAt) index.set(key, row);
  }
  const allGroups = plans.flatMap(plan => selectedChannels.map(channel => {
    const cells = matchingRegions.map(region => {
      const key = keyOf({ ...plan, channel, countryCode: region.code });
      return { region, row: index.get(key), check: checkIndex.get(key) };
    });
    const priced = cells.filter(cell => cell.row && cell.row.priceKind === "exact" && hasCurrentCnyEstimate(cell.row) && isFreshOfficialSubscriptionPrice(cell.row));
    const comparable = priced.map(cell => Number(cell.row!.cnyEstimate));
    // The cheapest region this plan is actually sold at, kept whole rather than as a
    // number: a floor that cannot name its region is not checkable. Computed over every
    // matching region, before the page slice, so it does not change as you page across.
    const floor = priced.reduce<(typeof priced)[number] | null>((best, cell) =>
      !best || Number(cell.row!.cnyEstimate) < Number(best.row!.cnyEstimate) ? cell : best, null);
    return { plan, channel, cells, minimum: comparable.length > 1 ? Math.min(...comparable) : null, floor };
  })).filter(group => !freshOnly || group.cells.some(cell => cell.row && isFreshOfficialSubscriptionPrice(cell.row) && cell.row.priceKind === "exact"))
    .map(group => ({ ...group, cells: group.cells.slice(offset, offset + pageSize) }));
  const rowPagination = comparisonPage(allGroups, first(params.compare_rows_page));
  const groups = rowPagination.rows;
  const rowHref = (next: number) => {
    const url = new URL(pageHref(page), "https://priceai.io");
    if (next > 1) url.searchParams.set("compare_rows_page", String(next));
    else url.searchParams.delete("compare_rows_page");
    return `${url.pathname}${url.search}${url.hash}`;
  };
  const rowNavigation = rowPagination.pageCount > 1 && <nav className={styles.pagination} aria-label="套餐渠道分页">
    {rowPagination.page > 1 ? <Link href={rowHref(rowPagination.page - 1)} prefetch={false}>← 上一组套餐</Link> : <span />}
    <span>套餐与渠道 · 第 {rowPagination.page} / {rowPagination.pageCount} 页 · 共 {allGroups.length} 行</span>
    {rowPagination.page < rowPagination.pageCount ? <Link href={rowHref(rowPagination.page + 1)} prefetch={false}>下一组套餐 →</Link> : <span />}
  </nav>;
  const total = plans.length * selectedChannels.length * matchingRegions.length;
  const allCells = plans.flatMap(plan => selectedChannels.flatMap(channel => matchingRegions.map(region => index.get(keyOf({ ...plan, channel, countryCode: region.code })))));
  const current = allCells.filter(row => row?.priceKind === "exact" && isFreshOfficialSubscriptionPrice(row)).length;
  const historical = allCells.filter(row => row?.priceKind === "exact" && !isFreshOfficialSubscriptionPrice(row)).length;
  return <section id="price-comparison" className={styles.section} aria-labelledby="comparison-heading">
    <header className={styles.heading}><div><p className="priceai-kicker">各 AI · 各档位 · 各地区</p><h2 id="comparison-heading">订阅价格对照表</h2><p>一行一个套餐与购买渠道，横向比较地区。原币金额在上，人民币估算在下。</p></div><Link href="/official-prices/regions">单套餐详情 ↗</Link></header>
    <Form action="/official-prices#price-comparison" className={styles.filters}>
      {["q", "vendor", "channel", "period"].map(key => first(params[key]) ? <input key={key} type="hidden" name={key} value={first(params[key])} /> : null)}
      <label htmlFor="compare-vendor">AI 产品<select id="compare-vendor" name="compare_vendor" defaultValue={vendor}><option value="">全部 AI</option>{Object.entries(vendors).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="compare-period">付费周期<select id="compare-period" name="compare_period" defaultValue={period}><option value="">全部周期</option><option value="month">月付</option><option value="year">年付</option></select></label>
      <label htmlFor="compare-channel">购买渠道<select id="compare-channel" name="compare_channel" defaultValue={channel}><option value="">全部渠道</option>{Object.entries(channels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="compare-region">地区<select id="compare-region" name="compare_region" defaultValue={region}><option value="">全部地区（分页）</option>{regions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label htmlFor="compare-basis">金额口径<select id="compare-basis" name="compare_basis" defaultValue={monthly ? "month" : "cycle"}><option value="cycle">每期总价</option><option value="month">每月折算</option></select></label>
      <label className={styles.checkbox}><input type="checkbox" name="compare_fresh" value="1" defaultChecked={freshOnly} />只看周期明确且近期核验的行</label>
      <button type="submit">更新对照表</button><Link href="/official-prices#price-comparison">重置</Link>
    </Form>
    <div className={styles.coverage} role="status"><b>筛选范围内：{current} / {total} 项周期明确且近期核验</b><span>{historical} 项为历史或待核验金额</span><span>{total - current - historical} 项尚无精确价</span></div>
    <p className={styles.meta}>{plans.length} 个目录套餐 · {matchingRegions.length} 个地区 · 本页 {visibleRegions.length} 个地区 · 本页 {groups.length} 行<span>较低价标记按筛选范围内全部地区计算，不因翻页改变；未统一税费与购买资格</span></p>
    {rowNavigation}
    {checks === null && <p role="status">采集状态暂不可用，已保存的价格仍可查看。</p>}
    {!available ? <p role="status">暂时无法读取价格数据，请稍后刷新重试。</p> : !groups.length ? <p role="status">当前条件下没有新核验报价，请取消勾选或重置筛选。</p> : <div className={styles.scroll} tabIndex={0} role="region" aria-label="订阅价格对照表，可左右滚动">
      <table className={styles.table}>
        <caption className="sr-only">每行一个套餐与渠道，每列一个地区，同时保留原币及人民币价格</caption>
        <thead><tr><th scope="col" className={styles.identity}>AI / 套餐 / 渠道</th>{visibleRegions.map(item => <th scope="col" key={item.code}>{item.name}<small>{item.code}</small></th>)}<th scope="col" className={styles.floor}>官方底价<small>全部地区最低</small></th></tr></thead>
        <tbody>{groups.map(({ plan, channel, cells, minimum, floor }, index) => <tr key={`${plan.planCode}:${channel}`} className={index === 0 || groups[index - 1]?.plan.planCode !== plan.planCode ? styles.groupStart : undefined}>
          <th scope="row" className={styles.identity}><span className={styles.vendor}>{vendors[plan.vendor]}</span><Link href={`/official-prices/regions?plan=${encodeURIComponent(plan.planCode)}`}>{plan.displayName}</Link><small>{periods[plan.billingPeriod]}{plan.billingPeriod === "year" ? " · 整年扣款" : ""}</small><ChannelBadge channel={channel} vendor={plan.vendor} /></th>
          {cells.map(({ region, row, check }) => <td key={region.code}><Cell row={row} check={check} monthly={monthly} lowest={Boolean(row && matchingRegions.length > 1 && isFreshOfficialSubscriptionPrice(row) && hasCurrentCnyEstimate(row) && minimum !== null && Number(row.cnyEstimate) === minimum)} /></td>)}
          <td className={styles.floor}>{floor?.row ? <div className={styles.quote}>
            <strong>≈ ¥{amount(Number(floor.row.cnyEstimate) / (monthly && floor.row.billingPeriod === "year" && hasVerifiedSubscriptionBilling(floor.row) ? 12 : 1))}</strong>
            <span className={styles.original}>{floor.region.name} · {floor.row.currency} {amount(Number(floor.row.amount))}</span>
            <em className={styles.state}>{getOfficialSubscriptionPriceStatus(floor.row)}</em>
          </div> : <span className={styles.missing}>暂无可比官方价</span>}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {rowNavigation}
    {pagination}
    <p className={styles.note}>年付“每月折算”仅用于预算比较，付款仍收取整年费用。人民币金额使用记录对应的汇率，未另加税费和跨境支付费；“公告参考价”及待核验记录不参与较低价标记。缺少价格不代表该地区或渠道不支持订阅，购买资格请在官方结算页确认。</p>
  </section>;
}
