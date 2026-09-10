import type { Metadata } from "next";
import Link from "next/link";
import { getChannelCatalog, type ChannelCatalog, type ChannelRow } from "@/lib/channel-catalog";
import { activeChannelChips, catalogView, channelHref, channelMode, channelMoney, channelOwnership, channelSpecParts, channelTime, channelWarranty, CHANNEL_MODES, CHANNEL_PLATFORMS, CHANNEL_WARRANTIES, parseChannelFilters, type ChannelFilters } from "@/lib/channel-filters";
import { ModelIcon, type ModelIconName } from "../model-icons";
import { SiteFooter } from "../site-footer";
import styles from "./channels.module.css";
import { MerchantResults } from "./merchant-results";
import { ChannelFilterForm } from "./filter-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "卡网订阅比价：AI 代充、成品账号与团队席位 | PriceAI",
  description: "比较 ChatGPT、Claude、Gemini 等 AI 订阅的卡网报价。按交付方式、期限、质保和库存筛选，查看原始商品、核验时间与商家来源。",
  alternates: { canonical: "/channels" },
};

type CatalogView = "products" | "offers" | "merchants";

const icons: Record<string, ModelIconName> = { OpenAI: "openai", Anthropic: "claude", Google: "gemini", xAI: "grok", Perplexity: "perplexity" };

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
  return <><b>{channelMode(row.offer_mode)}</b><small>{row.duration_days ? `${row.duration_days} 天` : "期限待确认"} · {row.region || "地区未标注"}</small><small>{channelOwnership(row.account_ownership)} · {channelWarranty(row.warranty_type, row.warranty_hours)}</small></>;
}

// Keeps the reader's search, stock and sort while narrowing to one specification.
function CompareLink({ row, filters }: { row: ChannelRow; filters: ChannelFilters }) {
  return <Link scroll={false} className={styles.button} href={channelHref(filters, { view: "compare", group: "expanded", spec: row.spec_key })}>比较这 {row.offer_count} 条报价 →</Link>;
}

function ReportOffer({ row }: { row: ChannelRow }) {
  return <details className={styles.report}><summary>举报问题</summary><form action="/api/reports" method="post">
    <input type="hidden" name="targetType" value="offer" /><input type="hidden" name="targetId" value={row.id} /><input type="hidden" name="returnTo" value="/channels?group=expanded" />
    <label>问题类型<select name="reportType"><option value="wrong_price">价格错误</option><option value="out_of_stock">已缺货</option><option value="delisted">已下架</option><option value="misclassified">分类错误</option></select></label>
    <label>问题说明<textarea name="details" required maxLength={1200} placeholder="请描述原站与报价的差异" /></label>
    <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" /><button className={styles.button} type="submit">提交举报</button>
  </form></details>;
}

function Results({ data, filters, view }: { data: ChannelCatalog; filters: ChannelFilters; view: CatalogView }) {
  if (view === "merchants") return <MerchantResults data={data} layout={filters.layout} />;
  const expanded = view === "offers";
  return <ul className={styles.quoteList} aria-label={expanded ? "原始商品报价" : "同规格参考报价"}>
    {data.rows.map(row => <li className={styles.quoteRow} key={`${row.id}-${row.currency}`}>
      <div className={styles.product}><ProductMark platform={row.platform} /><div><Link href={`/products/${row.product_slug}`}><b>{expanded ? row.raw_title : row.product_name}</b></Link>{expanded ? <small><Link href={`/merchants/${row.merchant_slug}`}>{row.merchant_name}</Link> · {row.product_name}</small> : <small>{row.platform}</small>}</div></div>
      <div className={styles.quoteFacts}><OfferFacts row={row} /></div>
      <div className={styles.quotePrice}><span className={styles.quoteLabel}>{expanded ? "原站报价" : "有货参考最低价"}</span><strong className={styles.price}>{channelMoney(row.price, row.currency)}</strong><small>{row.currency} · {row.duration_days ? `${row.duration_days} 天总价` : "期限待确认"}</small>{expanded && !row.available && <small>不计入有货最低价</small>}{!expanded && row.price === null && <small>暂无有货且期限明确的报价</small>}</div>
      <div className={styles.quoteStock}>{expanded ? <><OfferStatus row={row} /><small>{row.stock_count === null ? "数量未提供" : `数量 ${row.stock_count}`}</small></> : <><b>{row.merchant_count} 家 · {row.offer_count} 条</b><small>{row.available_count} 条已确认有货</small></>}</div>
      <div className={styles.quoteTime}><span className={styles.quoteLabel}>最近核验 · 北京时间</span><time dateTime={row.verified_at ? new Date(row.verified_at).toISOString() : undefined}>{channelTime(row.verified_at)}</time></div>
      <div className={styles.quoteActions}>{expanded ? <>{row.available ? <a className={styles.button} href={`/out/${row.id}`} target="_blank" rel="noopener noreferrer nofollow">前往原站 ↗</a> : <Link className={styles.button} href={`/products/${row.product_slug}?stock=all`}>看同款其他报价 →</Link>}{row.risk_facts.length > 0 && <details className={styles.risks}><summary>{row.risk_facts.length} 项需注意</summary><ul>{row.risk_facts.map(fact => <li key={fact}>{fact}</li>)}</ul></details>}<ReportOffer row={row} /></> : <CompareLink row={row} filters={filters} />}</div>
    </li>)}
  </ul>;
}

function ChannelSort({ filters }: { filters: ChannelFilters }) {
  return <label>排序<select name="sort" defaultValue={filters.sort}><option value="freshness">最近核验</option>{filters.view === "merchants" && <option value="low_price">低价规格最多</option>}{filters.view !== "merchants" && <option value="price">同币种价格最低</option>}<option value="offers">报价数量最多</option></select></label>;
}

function ChannelFilterFields({ filters, includeSort = false }: { filters: ChannelFilters; includeSort?: boolean }) {
  return <div className={styles.filterRow}>
    <label>商品范围<select name="catalog" defaultValue={filters.catalog ?? "subscriptions"}><option value="subscriptions">AI 订阅与账号</option><option value="resources">周边与使用服务</option></select></label>
    <label>模型<select name="platform" defaultValue={filters.platform}>{CHANNEL_PLATFORMS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>交付<select name="mode" defaultValue={filters.mode}><option value="">全部方式</option>{Object.entries(CHANNEL_MODES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>期限<select name="duration" defaultValue={filters.duration}><option value="">全部期限</option>{[7, 30, 90, 180, 365].map(days => <option key={days} value={days}>{days} 天</option>)}</select></label>
    <label>质保<select name="warranty" defaultValue={filters.warranty}><option value="">全部质保</option>{Object.entries(CHANNEL_WARRANTIES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label>库存<select name="stock" defaultValue={filters.stock}><option value="all">全部状态</option><option value="available">仅已确认有货</option></select></label>
    <label>币种<select name="currency" defaultValue={filters.currency}><option value="">全部币种</option>{["CNY", "USD", "HKD", "EUR", "JPY"].map(currency => <option key={currency}>{currency}</option>)}</select></label>
    {includeSort && <ChannelSort filters={filters} />}
  </div>;
}

export default async function ChannelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const filters = parseChannelFilters(raw);
  const view = catalogView(filters);
  let failed = false;
  let data: ChannelCatalog = { rows: [], total: 0, page: 1, pageSize: 24, offerCount: 0, merchantCount: 0, availableCount: 0, latest: null, spec: null };
  try { data = await getChannelCatalog(filters); } catch (error) { failed = true; console.error("Channel catalog unavailable", error instanceof Error ? error.message : "unknown error"); }
  const chips = activeChannelChips(filters);
  const hasFilters = chips.length > 0 || Boolean(filters.spec);
  const resultUnit = view === "merchants" ? "家商家" : view === "offers" ? "条报价" : "组规格";
  // Never repeat the headline count in the breakdown beside it.
  const detail = [view !== "offers" && `${data.offerCount} 条报价`, view !== "merchants" && `${data.merchantCount} 家商家`, `${data.availableCount} 条已确认有货`].filter(Boolean).join(" · ");
  const sortDropped = raw.sort === "price" && filters.view === "merchants";
  const cleared = channelHref(parseChannelFilters({ view: filters.view, group: filters.group, layout: filters.layout }));
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <div className={`priceai-page ${styles.page}`}><main className={styles.shell}>
    <nav className={styles.breadcrumb} aria-label="面包屑"><Link href="/">首页</Link><span aria-hidden="true">/</span><span>卡网订阅</span></nav>
    <header className={`${styles.hero} ${view === "merchants" ? styles.merchantHero : ""}`}>
      <div className={styles.heroCopy}><p className={styles.eyebrow}>卡网订阅 · 公开报价</p><h1>{view === "merchants" ? "卡网商家，一览再比较" : <>选对交付方式，<br />再比较价格</>}</h1><p className={styles.intro}>{view === "merchants" ? "查看店铺覆盖的商品、当前有货报价和同规格低价表现。选中商家后查看详细报价，或回到原店铺核对交付与售后。" : "卡网指第三方发卡与代充店铺，账号归属和售后各不相同。先确认期限、库存与质保，再比较同规格价格，回到原店铺核验下单。"}</p>
        <div className={styles.heroActions}><a className={styles.primary} href="#channel-results">{view === "merchants" ? "查看卡网商家" : "立即开始比价"} →</a><Link className={styles.button} href="/official-prices">先看官方订阅价 ↗</Link></div>
        <ul className={styles.heroBenefits}><li>公开报价聚合</li><li>核验时间可查</li><li>同规格比价</li></ul>
      </div>
      {view !== "merchants" && <>
        <div className={styles.heroVisual} aria-hidden="true">
          <div className={styles.visualSheet}><span className={styles.visualKicker}>订阅之前，先确认</span><div className={styles.visualModels}><ProductMark platform="OpenAI" /><ProductMark platform="Anthropic" /><ProductMark platform="Google" /></div><strong>你的订阅，你来选择</strong><span className={styles.visualLine} /><div className={styles.visualChecklist}><span>账号归属</span><b>谁来掌握？</b><span>使用期限</span><b>能用多久？</b><span>售后质保</span><b>如何处理？</b></div></div>
          <span className={styles.visualStamp}>同规格<br /><b>再比价</b></span>
          <p className={styles.visualCaption}>把购买条件，放在价格旁边。</p>
        </div>
        <nav className={styles.delivery} aria-label="按交付方式筛选">{[
          ["recharge", "01", "代充开通", "在已有账号上充值，先确认开通要求。"],
          ["finished_account", "02", "成品账号", "核对账号归属、改绑条件与售后。"],
          ["team_seat", "03", "团队席位", "核对席位期限、权限与移除规则。"],
        ].map(([mode = "", number, title, description]) => <Link className={filters.mode === mode ? styles.deliverySelected : styles.deliveryItem} href={`${channelHref(filters, { mode: filters.mode === mode ? "" : mode, spec: "" })}#channel-results`} aria-current={filters.mode === mode ? "true" : undefined} key={mode}><span className={styles.number}>{number}</span><span><b>{title}</b><p>{description}</p></span><span className={styles.deliveryState}>{filters.mode === mode ? "取消" : "→"}</span></Link>)}</nav>
      </>}
    </header>
    <section className={styles.workspace} id="channel-results" aria-label="卡网报价与商家筛选" tabIndex={-1}>
    <div className={styles.workspaceHeading}><nav className={styles.tabs} aria-label="卡网订阅视图">
      <Link scroll={false} href={channelHref(filters, { view: "compare" })} aria-current={filters.view === "compare" ? "page" : undefined}>比价</Link>
      <Link scroll={false} href={channelHref(filters, { view: "merchants" })} aria-current={filters.view === "merchants" ? "page" : undefined}>卡网商家</Link>
    </nav><Link className={styles.textLink} href="/submit">提交店铺 ＋</Link></div>
    {view === "merchants" && <div className={styles.merchantToolbar}>
      <nav className={styles.platformTabs} aria-label="按模型查看商家">{CHANNEL_PLATFORMS.map(([value, label]) => <Link scroll={false} key={value} href={channelHref(filters, { platform: value })} aria-current={filters.platform === value ? "true" : undefined}>{value ? label : "全部模型"}</Link>)}</nav>
      <div className={styles.groupToggle} role="group" aria-label="商家显示方式"><Link scroll={false} href={channelHref(filters, { layout: "cards", page: data.page })} aria-current={filters.layout === "cards" ? "true" : undefined}>卡片</Link><Link scroll={false} href={channelHref(filters, { layout: "table", page: data.page })} aria-current={filters.layout === "table" ? "true" : undefined}>表格</Link></div>
    </div>}
    {filters.view === "compare" && <div className={styles.groupToggle} role="group" aria-label="比价表显示方式"><span>显示</span>
      <Link scroll={false} href={channelHref(filters, { group: "merged" })} aria-current={filters.group === "merged" ? "true" : undefined}>合并同规格</Link>
      <Link scroll={false} href={channelHref(filters, { group: "expanded" })} aria-current={filters.group === "expanded" ? "true" : undefined}>展开每条报价</Link>
      <small>{filters.group === "merged" ? "一行 = 一个可比规格的最低价" : "一行 = 一条店铺原始报价"}</small>
    </div>}
    {hasFilters && <div className={styles.activeFilters}>
      {filters.spec && <p className={styles.specLock}><span className={styles.specLockLabel}>已锁定规格</span>{data.spec
        ? <span className={styles.specLockBody}><b>{data.spec.product_name}</b>{channelSpecParts(data.spec).map((part, index) => <span key={index}>{part}</span>)}</span>
        : <span className={styles.specLockBody}>该规格当前没有在售报价</span>}<span className={styles.specLockHint}>{filters.view === "merchants" ? "只看有这一规格报价的商家" : "只看这一规格的报价"}</span><Link scroll={false} className={styles.chipClear} href={channelHref(filters, { spec: "" })}>✕ 取消锁定</Link></p>}
      {chips.length > 0 && <p className={styles.chips}>{chips.map(chip => <Link scroll={false} className={styles.chip} key={chip.key} href={chip.clearHref}>{chip.label}<span aria-hidden="true">✕</span></Link>)}<Link scroll={false} className={styles.textLink} href={cleared}>清空全部</Link></p>}
    </div>}
    <ChannelFilterForm className={styles.filters} key={channelHref(filters)}>
      <input type="hidden" name="layout" value={filters.layout} /><input type="hidden" name="view" value={filters.view} /><input type="hidden" name="group" value={filters.group} />
      {filters.spec && <input type="hidden" name="spec" value={filters.spec} />}
      <div className={styles.searchRow}><label className={styles.search}><span className="sr-only">搜索商品或商家</span><span aria-hidden="true">⌕</span><input name="q" defaultValue={filters.q} placeholder={view === "merchants" ? "搜索店铺名、域名或商品" : "搜索商品、原始商品名或商家"} maxLength={160} /></label><button type="submit" className={styles.primary}>应用筛选</button></div>
      {view === "merchants" ? <div className={styles.merchantFilterTools}>
        <details className={styles.advancedFilters}><summary>更多筛选 · 交付 / 期限 / 库存</summary><ChannelFilterFields filters={filters} /></details>
        <div className={styles.filterRow}><ChannelSort filters={filters} /></div>
      </div> : <ChannelFilterFields filters={filters} includeSort />}
    </ChannelFilterForm>
    {raw.reported === "1" && <p className={styles.tableNote} role="status">举报已提交，审核后会更新异常报价。</p>}
    {sortDropped && <p className={styles.tableNote} role="status">商家视图不能按价格排序，已改为按最近核验排序。</p>}
    <div className={styles.resultMeta} role="status"><span>{failed ? "报价暂时无法加载" : `${data.total} ${resultUnit}`}{!failed && <span className={styles.metaDetail}> · {detail}</span>}</span>{!failed && <span className={styles.metaDetail}>最近核验 {channelTime(data.latest)}</span>}</div>
    <p className={styles.tableNote}>{view === "merchants" ? "商家列表按已发布报价汇总，收录不代表推荐或担保。"
      : view === "offers" ? "每行是一条店铺原始报价。未知库存、缺货及超过 24 小时未核验的报价不计入有货最低价。"
        : "同规格才比较：按交付、期限、地区、账号归属、质保与币种分组。未知库存、缺货及超过 24 小时未核验的报价不计入有货最低价。"}</p>
    {view === "merchants" && <details className={styles.rankingNote}><summary>低价表现如何计算？</summary><p>以当前发布数据为准，仅统计 24 小时内核验有货、期限明确且至少有两家商家可比的规格。交付、期限、地区、账号归属、质保和币种必须一致。同一商家每个规格取最低价；并列同价同名次。分母是当前筛选范围内的可比规格数，分子是其中最低价或价格排名前五的规格数。搜索店铺不会缩小竞价商家范围。按低价规格最多排序时，依次比较最低价、前五价、可比规格和有货报价数量；这些数据不代表商家信誉。</p></details>}
    {data.rows.length ? <Results data={data} filters={filters} view={view} /> : <section className={styles.empty} aria-labelledby="empty-title"><span className={styles.emptySymbol} aria-hidden="true">⌕</span><h2 id="empty-title">{failed ? "暂时无法读取渠道报价" : hasFilters ? (view === "merchants" ? "没有符合条件的商家" : "还没有符合这些条件的报价") : "渠道报价正在接入"}</h2><p>{failed ? "价格服务暂时不可用，请稍后重试。你也可以先查看官方订阅和购买指南。" : hasFilters ? "尝试放宽交付方式、期限或库存条件，也可以提交你希望收录的店铺链接。" : "审核并发布后，这里会展示可追溯的商品、商家、库存和核验时间。暂不展示未经核验的价格。"}</p><div className={styles.emptyActions}>{failed ? <a className={styles.button} href={channelHref(filters)}>重新加载</a> : hasFilters ? <Link scroll={false} className={styles.button} href={cleared}>清空全部筛选</Link> : <Link className={styles.button} href="/submit">提交店铺 ＋</Link>}<Link className={styles.textLink} href="/official-prices">查看官方订阅 →</Link></div></section>}
    {pages > 1 && <nav className={styles.pagination} aria-label="结果分页">{data.page > 1 ? <Link scroll={false} className={styles.button} href={channelHref(filters, { page: data.page - 1 })}>← 上一页</Link> : <span />}<span>第 {data.page} / {pages} 页 · 每页最多 {data.pageSize} 条</span>{data.page < pages ? <Link scroll={false} className={styles.button} href={channelHref(filters, { page: data.page + 1 })}>下一页 →</Link> : <span />}</nav>}
    </section>
    <aside className={styles.guide}><div><p className={styles.eyebrow}>买前核对</p><h2>便宜之外，确认你实际拿到什么</h2></div><ol><li><b>账号归谁</b><span>自己的账号、成品账号和团队席位，控制权与使用边界不同。</span></li><li><b>质保多久</b><span>仅保首登不等于订阅期质保，付款前保存商品说明。</span></li><li><b>报价何时确认</b><span>库存和价格可能变化，最终以原店铺结算页面为准。</span></li></ol><Link className={styles.textLink} href="/guides">阅读购买指南 →</Link></aside>
    <p className={styles.disclaimer}>PriceAI 不销售、不代收款、不替渠道背书。交易与售后在原平台完成。</p>
  </main><SiteFooter /></div>;
}
