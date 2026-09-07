import Link from "next/link";
import { OFFICIAL_SUBSCRIPTION_PLAN_CATALOG as catalog, OFFICIAL_SUBSCRIPTION_REGION_CATALOG as regionCatalog } from "@price-radar/price-channels/subscription-catalog";
import { isFreshOfficialSubscriptionPrice, type OfficialSubscriptionPrice } from "@/lib/public-pricing";
import styles from "./price-comparison.module.css";

const vendors: Record<string, string> = { openai: "ChatGPT", anthropic: "Claude", google: "Gemini", xai: "Grok" };
const channels: Record<string, string> = { web: "官网直购", app_store: "iOS Store", google_play: "Google Play" };
const periods: Record<string, string> = { month: "月付", year: "年付", one_time: "一次性" };
type Params = Record<string, string | string[] | undefined>;
const first = (value: Params[string]) => (Array.isArray(value) ? value[0] : value) ?? "";
const number = (value: string) => Number(value).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function GoMissingChannel({ channel }: { channel: string }) {
  return <div className={styles.quote}><span className={styles.channel}>{channels[channel]}</span><span className={styles.missing}>当地价格待采集</span><a className={styles.rate} href="https://help.openai.com/en/articles/11989085-what-is-chatgpt-go" target="_blank" rel="noopener noreferrer">Go 支持此订阅渠道 ↗</a></div>;
}

function Quote({ row }: { row: OfficialSubscriptionPrice }) {
  const original = row.priceKind === "exact" && row.amount !== null ? `${row.currency} ${number(row.amount)}`
    : row.priceKind === "range" && row.lowerAmount !== null && row.upperAmount !== null ? `${row.currency} ${number(row.lowerAmount)}–${number(row.upperAmount)}` : "未公开精确价";
  return <div className={styles.quote}>
    <span className={styles.channel}>{channels[row.channel] ?? row.channel}{row.evidenceUrl.includes("/introducing-chatgpt-go/") ? <em>公告参考价</em> : !isFreshOfficialSubscriptionPrice(row) && <em>待更新</em>}</span>
    <a href={row.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow" title="查看官方价格来源">{original} ↗</a>
    <strong>{row.priceKind === "exact" && row.cnyEstimate !== null ? `≈ ¥${number(row.cnyEstimate)}` : "人民币换算待补"}</strong>
    <time dateTime={row.verifiedAt.toISOString()}>{row.evidenceUrl.includes("/introducing-chatgpt-go/") ? "公告 " : "核验 "}{row.verifiedAt.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit" })}</time>
    {row.exchangeRateDate && row.exchangeRateUrl && <a className={styles.rate} href={row.exchangeRateUrl} target="_blank" rel="noopener noreferrer nofollow">汇率 {row.exchangeRateDate}</a>}
  </div>;
}

export function PriceComparison({ rows, params, available }: { rows: OfficialSubscriptionPrice[]; params: Params; available: boolean }) {
  const vendor = first(params.compare_vendor), period = first(params.compare_period), channel = first(params.compare_channel), region = first(params.compare_region);
  const plans = catalog.filter((plan) => (!vendor || plan.vendor === vendor) && (!period || plan.billingPeriod === period));
  const regions = [...regionCatalog.map((item) => ({ code: item.countryCode, name: item.displayName })),
    ...[...new Set(rows.map((row) => row.countryCode))].filter((code) => !regionCatalog.some((item) => item.countryCode === code)).sort().map((code) => ({ code, name: code }))];
  const visibleRegions = regions.filter((item) => !region || item.code === region);
  const filtered = rows.filter((row) => (!vendor || row.vendor === vendor) && (!period || row.billingPeriod === period) && (!channel || row.channel === channel) && (!region || row.countryCode === region));
  const index = new Map<string, OfficialSubscriptionPrice[]>();
  for (const row of filtered) {
    const key = `${row.vendor}:${row.planCode}:${row.billingPeriod}:${row.countryCode}`;
    index.set(key, [...(index.get(key) ?? []), row]);
  }
  return <section id="price-comparison" className={styles.section} aria-labelledby="comparison-heading">
    <header className={styles.heading}><div><p className="priceai-kicker">各 AI · 各档位 · 各地区</p><h2 id="comparison-heading">订阅价格对照表</h2><p>每格先看当地币种标价，再看人民币估算。月付与年付分别展示，年付金额为整年费用。</p></div><Link href="/official-prices/regions">单套餐渠道对照 ↗</Link></header>
    <form action="/official-prices#price-comparison" className={styles.filters}>
      {["q", "vendor", "channel", "period"].map((key) => first(params[key]) ? <input key={key} type="hidden" name={key} value={first(params[key])} /> : null)}
      <label htmlFor="compare-vendor"><span>AI 产品</span><select aria-label="AI 产品" id="compare-vendor" name="compare_vendor" defaultValue={vendor}><option value="">全部 AI</option>{Object.entries(vendors).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="compare-period"><span>付费周期</span><select aria-label="付费周期" id="compare-period" name="compare_period" defaultValue={period}><option value="">全部周期</option><option value="month">月付</option><option value="year">年付</option></select></label>
      <label htmlFor="compare-channel"><span>购买渠道</span><select aria-label="购买渠道" id="compare-channel" name="compare_channel" defaultValue={channel}><option value="">全部渠道</option>{Object.entries(channels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="compare-region"><span>地区</span><select aria-label="地区" id="compare-region" name="compare_region" defaultValue={region}><option value="">全部地区</option>{regions.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <button type="submit">更新对照表</button><Link href="/official-prices#price-comparison">重置</Link>
    </form>
    <p className={styles.meta}>{plans.length} 个套餐 · {visibleRegions.length} 个地区 · {filtered.length} 条报价记录<span>左右滑动查看所有地区；点击原币价查看来源</span></p>
    {!available ? <p role="status">暂时无法读取价格数据，请稍后刷新重试。</p> : !plans.length || !visibleRegions.length ? <p role="status">没有匹配的套餐或地区，请重置筛选。</p> : <div className={styles.scroll} tabIndex={0} role="region" aria-label="订阅价格对照表，可左右滚动">
      <table className={styles.table}>
        <caption className="sr-only">各 AI 套餐按地区对照的原币价格与人民币估算</caption>
        <thead><tr><th scope="col">AI / 套餐档位</th>{visibleRegions.map((item) => <th scope="col" key={item.code}>{item.name}<small>{item.code}</small></th>)}</tr></thead>
        <tbody>{plans.map((plan) => <tr key={`${plan.vendor}:${plan.planCode}:${plan.billingPeriod}`}>
          <th scope="row"><span className={styles.vendor}>{vendors[plan.vendor] ?? plan.vendor}</span><Link href={`/official-prices/regions?plan=${encodeURIComponent(plan.planCode)}`}>{plan.displayName}</Link><small>{periods[plan.billingPeriod] ?? plan.billingPeriod}{plan.billingPeriod === "year" ? " · 整年总价" : " · 每期价格"}</small></th>
          {visibleRegions.map((item) => { const quotes = index.get(`${plan.vendor}:${plan.planCode}:${plan.billingPeriod}:${item.code}`) ?? []; return <td key={item.code}>{plan.planCode === "chatgpt-go-monthly" ? Object.keys(channels).filter((key) => !channel || key === channel).map((key) => { const matches = quotes.filter((row) => row.channel === key); return matches.length ? matches.map((row) => <Quote key={row.id} row={row} />) : <GoMissingChannel key={key} channel={key} />; }) : quotes.length ? [...quotes].sort((a, b) => Object.keys(channels).indexOf(a.channel) - Object.keys(channels).indexOf(b.channel)).map((row) => <Quote key={row.id} row={row} />) : <span className={styles.missing}>尚无报价</span>}</td>; })}
        </tr>)}</tbody>
      </table>
    </div>}
    <p className={styles.note}>Go 支持官网、iOS 和 Google Play 订阅，地区及账户资格以实际结算为准。公告参考价保留公告日期，不代表已核验当前结算价。人民币金额按记录所关联的汇率估算，未另加税费及跨境支付手续费。“待更新”保留上次核验价格；“尚无报价”表示尚未收录，不代表免费或不能购买。</p>
  </section>;
}
