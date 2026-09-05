import type { Metadata } from "next";
import Link from "next/link";
import { getChannelCatalog, type ChannelCatalog, type ChannelRow } from "@/lib/channel-catalog";
import { CHANNEL_MODES, CHANNEL_PLATFORMS, CHANNEL_WARRANTIES, channelHref, channelMoney, channelTime, parseChannelFilters, type ChannelFilters } from "@/lib/channel-filters";
import { ModelIcon, type ModelIconName } from "../model-icons";
import { SiteHeader } from "../site-header";
import { SiteFooter } from "../site-footer";
import styles from "./channels.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "卡网订阅比价：AI 代充、成品账号与团队席位 | PriceAI",
  description: "比较 ChatGPT、Claude、Gemini 等 AI 订阅的卡网报价。按交付方式、期限、质保和库存筛选，查看原始商品、核验时间与商家来源。",
  alternates: { canonical: "/channels" },
};

const icons: Record<string, ModelIconName> = { OpenAI: "openai", Anthropic: "claude", Google: "gemini", xAI: "grok", Perplexity: "perplexity" };
const ownershipNames: Record<string, string> = { buyer: "自己的账号", merchant: "商家账号", shared: "共享账号", unknown: "归属待确认" };
const modeName = (value: string) => CHANNEL_MODES[value as keyof typeof CHANNEL_MODES] ?? "交付待确认";
const warrantyName = (value: string) => CHANNEL_WARRANTIES[value as keyof typeof CHANNEL_WARRANTIES] ?? "质保待确认";

function ProductMark({ platform }: { platform: string }) {
  const name = icons[platform];
  return <span className={styles.mark} aria-hidden="true">{name ? <ModelIcon name={name} label={platform} /> : platform.slice(0, 1)}</span>;
}

function OfferStatus({ row }: { row: ChannelRow }) {
  const stale = !row.verified_at || Date.now() - new Date(row.verified_at).getTime() >= 24 * 60 * 60 * 1000;
  const label = row.available ? row.stock_state === "low_stock" ? "库存紧张" : "有货"
    : row.stock_state === "out_of_stock" || row.stock_count === 0 ? "缺货"
      : stale ? "已过期，待复核" : row.stock_state === "unknown" ? "库存待确认" : "暂不可买";
  return <span className={row.available ? styles.available : styles.badge}>{label}</span>;
}

function OfferFacts({ row }: { row: ChannelRow }) {
  return <><b>{modeName(row.offer_mode)}</b><small>{row.duration_days ? `${row.duration_days} 天` : "期限待确认"} · {row.region || "地区未标注"}</small><small>{ownershipNames[row.account_ownership] ?? row.account_ownership} · {warrantyName(row.warranty_type)}{row.warranty_hours ? ` ${row.warranty_hours} 小时` : ""}</small></>;
}

function QuoteLink({ row }: { row: ChannelRow }) {
  return <Link className={styles.button} href={channelHref(parseChannelFilters({ view: "offers", spec: row.spec_key }))}>查看报价 →</Link>;
}

function ReportOffer({ row }: { row: ChannelRow }) {
  return <details className={styles.report}><summary>举报问题</summary><form action="/api/reports" method="post">
    <input type="hidden" name="targetType" value="offer" /><input type="hidden" name="targetId" value={row.id} /><input type="hidden" name="returnTo" value="/channels?view=offers" />
    <label>问题类型<select name="reportType"><option value="wrong_price">价格错误</option><option value="out_of_stock">已缺货</option><option value="delisted">已下架</option><option value="misclassified">分类错误</option></select></label>
    <label>问题说明<textarea name="details" required maxLength={1200} placeholder="请描述原站与报价的差异" /></label>
    <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" /><button className={styles.button} type="submit">提交举报</button>
  </form></details>;
}

function Results({ data, filters }: { data: ChannelCatalog; filters: ChannelFilters }) {
  if (filters.view === "merchants") return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="卡网商家表，可横向滚动"><table className={styles.table}>
    <caption className="sr-only">符合筛选条件的卡网商家，只统计当前已发布报价</caption>
    <thead><tr><th scope="col">商家</th><th scope="col">涉及商品</th><th scope="col">匹配报价</th><th scope="col">已确认有货</th><th scope="col">最近核验（北京时间）</th><th scope="col">来源</th></tr></thead>
    <tbody>{data.rows.map(row => <tr key={row.id}><td><Link className={styles.product} href={`/merchants/${row.merchant_slug}`}><span className={styles.mark} aria-hidden="true">{row.merchant_name.slice(0, 1)}</span><b>{row.merchant_name}</b></Link></td><td>{row.merchant_count}</td><td>{row.offer_count}</td><td>{row.available_count}</td><td>{channelTime(row.verified_at)}</td><td><Link className={styles.button} href={`/merchants/${row.merchant_slug}`}>查看商家 →</Link></td></tr>)}</tbody>
  </table></div>;
  return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="订阅比价表，可横向滚动"><table className={styles.table}>
    <caption className="sr-only">{filters.view === "offers" ? "原始商品报价及库存、交付方式和核验时间" : "按商品、交付、期限、地区、归属、质保和币种分组的参考价"}</caption>
    <thead><tr><th scope="col">{filters.view === "offers" ? "原始商品 / 商家" : "订阅商品"}</th><th scope="col">交付与规格</th><th scope="col">{filters.view === "offers" ? "原站报价" : "有货参考最低价"}</th><th scope="col">{filters.view === "offers" ? "库存状态" : "可比渠道"}</th><th scope="col">最近核验（北京时间）</th><th scope="col">操作</th></tr></thead>
    <tbody>{data.rows.map(row => <tr key={`${row.id}-${row.currency}`}>
      <td><div className={styles.product}><ProductMark platform={row.platform} /><div><Link href={`/products/${row.product_slug}`}><b>{filters.view === "offers" ? row.raw_title : row.product_name}</b></Link>{filters.view === "offers" ? <small><Link href={`/merchants/${row.merchant_slug}`}>{row.merchant_name}</Link> · {row.product_name}</small> : <small>{row.platform}</small>}</div></div></td>
      <td className={styles.facts}><OfferFacts row={row} /></td>
      <td><strong className={styles.price}>{channelMoney(row.price, row.currency)}</strong><small>{row.currency} · {row.duration_days ? `${row.duration_days} 天总价` : "期限待确认"}</small>{filters.view === "offers" && !row.available && <small>不计入有货最低价</small>}</td>
      <td>{filters.view === "offers" ? <><OfferStatus row={row} /><small>{row.stock_count === null ? "数量未提供" : `数量 ${row.stock_count}`}</small></> : <><b>{row.merchant_count} 家 · {row.offer_count} 条</b><small>{row.available_count} 条已确认有货</small></>}</td>
      <td><time dateTime={row.verified_at ? new Date(row.verified_at).toISOString() : undefined}>{channelTime(row.verified_at)}</time></td>
      <td className={styles.actions}>{filters.view === "offers" ? <>{row.available ? <a className={styles.button} href={`/out/${row.id}`} target="_blank" rel="noopener noreferrer nofollow">前往原站 ↗</a> : <Link className={styles.button} href={`/products/${row.product_slug}?stock=all`}>查看详情 →</Link>}{row.risk_facts.length > 0 && <details className={styles.risks}><summary>{row.risk_facts.length} 项需注意</summary><ul>{row.risk_facts.map(fact => <li key={fact}>{fact}</li>)}</ul></details>}<ReportOffer row={row} /></> : <QuoteLink row={row} />}</td>
    </tr>)}</tbody>
  </table></div>;
}

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const filters = parseChannelFilters(raw);
  let failed = false;
  let data: ChannelCatalog = { rows: [], total: 0, page: 1, pageSize: 24, offerCount: 0, merchantCount: 0, availableCount: 0, latest: null };
  try { data = await getChannelCatalog(filters); } catch (error) { failed = true; console.error("Channel catalog unavailable", error instanceof Error ? error.message : "unknown error"); }
  const hasFilters = Boolean(filters.spec || filters.q || filters.platform || filters.mode || filters.duration || filters.warranty || filters.currency || filters.stock !== "all");
  const tabs = [["products", "按规格比价"], ["offers", "全部报价"], ["merchants", "卡网商家"]] as const;
  const resultUnit = filters.view === "merchants" ? "家商家" : filters.view === "offers" ? "条报价" : "组商品规格";
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <div className="priceai-page"><SiteHeader active="channels" /><main className={styles.shell}>
    <nav className={styles.breadcrumb} aria-label="面包屑"><Link href="/">首页</Link><span aria-hidden="true">/</span><span>卡网订阅</span></nav>
    <header className={styles.hero}><div><p className={styles.eyebrow}>卡网订阅 · 公开报价</p><h1>选对交付方式，再比较价格</h1><p className={styles.intro}>从自己账号代充、成品账号到团队席位，把期限、库存和售后放在价格旁边。找到合适的报价，再回到原店铺核验。</p></div><Link className={styles.button} href="/official-prices">先看官方订阅价 ↗</Link></header>
    <section className={styles.delivery} aria-label="先选择交付方式">{[
      ["recharge", "01", "用自己的账号", "代充开通", "在已有账号上充值，先确认开通要求。"],
      ["finished_account", "02", "需要现成账号", "成品账号", "核对账号归属、改绑条件与售后。"],
      ["team_seat", "03", "加入团队使用", "团队席位", "核对席位期限、权限与移除规则。"],
    ].map(([mode = "", number, label, title, description]) => <Link className={filters.mode === mode ? styles.deliverySelected : styles.deliveryItem} href={channelHref(filters, { mode: filters.mode === mode ? "" : mode, spec: "" })} aria-current={filters.mode === mode ? "true" : undefined} key={mode}><span className={styles.number}>{number}</span><span><small>{label}</small><b>{title}</b><p>{description}</p></span><span aria-hidden="true">↗</span></Link>)}</section>
    <div className={styles.workspaceHeading}><nav className={styles.tabs} aria-label="卡网订阅视图">{tabs.map(([view, label]) => <Link href={channelHref(filters, { view })} aria-current={filters.view === view ? "page" : undefined} key={view}>{label}</Link>)}</nav><Link className={styles.textLink} href="/submit">提交公开渠道 ＋</Link></div>
    <form action="/channels" className={styles.filters} key={channelHref(filters)}><input type="hidden" name="view" value={filters.view} />
      {filters.spec && <><input type="hidden" name="spec" value={filters.spec} /><p className={styles.tableNote}>正在查看同一规格的报价。<Link className={styles.textLink} href={channelHref(filters, { spec: "" })}>取消规格限定</Link></p></>}
      <div className={styles.searchRow}><label className={styles.search}><span className="sr-only">搜索商品或商家</span><span aria-hidden="true">⌕</span><input name="q" defaultValue={filters.q} placeholder="搜索商品、原始商品名或商家" maxLength={160} /></label><button type="submit" className={styles.primary}>搜索 / 筛选</button></div>
      <div className={styles.filterRow}>
        <label>模型<select name="platform" defaultValue={filters.platform}>{CHANNEL_PLATFORMS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>交付<select name="mode" defaultValue={filters.mode}><option value="">全部方式</option>{Object.entries(CHANNEL_MODES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>期限<select name="duration" defaultValue={filters.duration}><option value="">全部期限</option>{[7, 30, 90, 180, 365].map(days => <option key={days} value={days}>{days} 天</option>)}</select></label>
        <label>售后<select name="warranty" defaultValue={filters.warranty}><option value="">全部质保</option>{Object.entries(CHANNEL_WARRANTIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>库存<select name="stock" defaultValue={filters.stock}><option value="all">全部状态</option><option value="available">仅已确认有货</option></select></label>
        <label>币种<select name="currency" defaultValue={filters.currency}><option value="">全部币种</option>{["CNY", "USD", "HKD", "EUR", "JPY"].map(currency => <option key={currency}>{currency}</option>)}</select></label>
        <label>排序<select name="sort" defaultValue={filters.sort}><option value="freshness">最近核验</option>{filters.view !== "merchants" && <option value="price">同币种价格最低</option>}<option value="offers">报价数量最多</option></select></label>
      </div>
    </form>
    {raw.reported === "1" && <p className={styles.tableNote} role="status">举报已提交，审核后会更新异常报价。</p>}
    <div className={styles.resultMeta} role="status"><span>{failed ? "报价暂时无法加载" : `${data.total} ${resultUnit}`}{!failed && <span className={styles.metaDetail}> · {data.offerCount} 条报价 · {data.merchantCount} 家商家 · {data.availableCount} 条已确认有货</span>}</span>{hasFilters ? <Link href={channelHref(parseChannelFilters({ view: filters.view }))}>清空筛选</Link> : !failed && <span className={styles.metaDetail}>最近核验 {channelTime(data.latest)}</span>}</div>
    <p className={styles.tableNote}>{filters.view === "merchants" ? "商家列表按已发布报价汇总，收录不代表推荐或担保。" : "按交付、期限、地区、账号归属、质保与币种分组。未知库存、缺货及超过 24 小时未核验的报价不计入有货最低价。"}</p>
    {data.rows.length ? <Results data={data} filters={filters} /> : <section className={styles.empty} aria-labelledby="empty-title"><span className={styles.emptySymbol} aria-hidden="true">⌕</span><h2 id="empty-title">{failed ? "暂时无法读取渠道报价" : hasFilters ? "还没有符合这些条件的报价" : "渠道报价正在接入"}</h2><p>{failed ? "价格服务暂时不可用，请稍后重试。你也可以先查看官方订阅和购买指南。" : hasFilters ? "尝试放宽交付方式、期限或库存条件，也可以提交你希望收录的公开商品链接。" : "审核并发布后，这里会展示可追溯的商品、商家、库存和核验时间。暂不展示未经核验的价格。"}</p><div className={styles.emptyActions}>{failed ? <a className={styles.button} href={channelHref(filters)}>重新加载</a> : hasFilters ? <Link className={styles.button} href={channelHref(parseChannelFilters({ view: filters.view }))}>清空筛选</Link> : <Link className={styles.button} href="/submit">提交渠道链接 ＋</Link>}<Link className={styles.textLink} href="/official-prices">查看官方订阅 →</Link></div></section>}
    {pages > 1 && <nav className={styles.pagination} aria-label="结果分页">{data.page > 1 ? <Link className={styles.button} href={channelHref(filters, { page: data.page - 1 })}>← 上一页</Link> : <span />}<span>第 {data.page} / {pages} 页 · 每页最多 {data.pageSize} 条</span>{data.page < pages ? <Link className={styles.button} href={channelHref(filters, { page: data.page + 1 })}>下一页 →</Link> : <span />}</nav>}
    <aside className={styles.guide}><div><p className={styles.eyebrow}>买前核对</p><h2>便宜之外，确认你实际拿到什么</h2></div><ol><li><b>账号归谁</b><span>自己的账号、成品账号和团队席位，控制权与使用边界不同。</span></li><li><b>售后多久</b><span>仅保首登不等于订阅期质保，付款前保存商品说明。</span></li><li><b>报价何时确认</b><span>库存和价格可能变化，最终以原店铺结算页面为准。</span></li></ol><Link className={styles.textLink} href="/guides">阅读购买指南 →</Link></aside>
    <p className={styles.disclaimer}>PriceAI 不销售、不代收款、不替渠道背书。交易与售后在原平台完成。</p>
  </main><SiteFooter /></div>;
}
