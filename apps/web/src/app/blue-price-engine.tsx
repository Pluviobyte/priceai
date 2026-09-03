import Link from "next/link";
import { ModelIcon, MODEL_ICON_PATHS, type ModelIconName } from "./model-icons";
import { OFFER_MODE_LABEL, type BaselineRow, type ChangeRow, type HomeSnapshot } from "@/lib/home-snapshot";

const BRAND_TABS = [["全部", ""], ["ChatGPT", "OpenAI"], ["Claude", "Anthropic"], ["Gemini", "Google"], ["Grok", "xAI"]] as const;

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>;
}

function cny(value: number) {
  return `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function iconOf(row: BaselineRow): ModelIconName | null {
  return row.icon && row.icon in MODEL_ICON_PATHS ? (row.icon as ModelIconName) : null;
}

function relative(iso: string | null) {
  if (!iso) return "尚未确认";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} 分钟前确认`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} 小时前确认`;
  return `${Math.round(minutes / 1440)} 天前确认`;
}

/** 价格分布条：官方价为右端 100%，最低价落点按比例定位。 */
function Band({ row }: { row: BaselineRow }) {
  if (!row.band || !row.official) return <span className="blue-engine-nodata">分布待补</span>;
  const max = Math.max(row.official.cny, row.band.maxCny);
  const left = Math.max(0, Math.min(100, (row.band.minCny / max) * 100));
  const width = Math.max(2, Math.min(100 - left, ((row.band.maxCny - row.band.minCny) / max) * 100));
  return <div className="blue-engine-range">
    <div className="blue-engine-range-track"><span className="blue-engine-range-fill" style={{ left: `${left}%`, width: `${width}%` }} /><i className="min" style={{ left: `${left}%` }} /><i className="max" /></div>
    <small><span>{cny(row.band.minCny)}</span><span>{cny(row.official.cny)} 官方</span></small>
  </div>;
}

function BaselineRowView({ row, placeholder }: { row: BaselineRow; placeholder: boolean }) {
  const icon = iconOf(row);
  const discount = row.official && row.lowest ? Math.round((1 - row.lowest.cny / row.official.cny) * 100) : null;
  return <div className="blue-engine-row">
    <div className="blue-engine-product">
      <span className="blue-engine-mark">{icon ? <ModelIcon name={icon} label={row.name} /> : <b>{row.name.slice(0, 1)}</b>}</span>
      <div><strong>{row.name}</strong><small>{row.spec}</small></div>
    </div>

    <div className="blue-engine-official">
      {row.official
        ? <><strong>{cny(row.official.cny)}</strong><small><a href={row.official.evidenceUrl} target="_blank" rel="noopener noreferrer">{row.official.note} ↗</a></small></>
        : <span className="blue-engine-nodata">官方价待确认</span>}
    </div>

    <div className="blue-engine-lowest">
      {row.lowest
        ? <>
            <div><strong>{cny(row.lowest.cny)}</strong>{discount !== null && discount > 0 && <span>−{discount}%</span>}</div>
            <p className="blue-engine-mode"><em>{OFFER_MODE_LABEL[row.lowest.mode]}</em>{row.lowest.warrantyNote}</p>
            <small>{row.lowest.merchantName ?? "渠道待确认"} · {relative(row.verifiedAt)}</small>
          </>
        : <span className="blue-engine-nodata">当前无有货报价</span>}
    </div>

    <Band row={row} />

    <div className="blue-engine-offers">
      {placeholder
        ? <span className="blue-engine-nodata">待接入</span>
        : <><strong>{row.offerCount}</strong><small>{row.inStockMerchantCount} 家有货</small></>}
    </div>

    <Link className="blue-engine-view" href={`/products/${row.slug}`}>看全部报价</Link>
  </div>;
}

function ChangeLine({ change }: { change: ChangeRow }) {
  const down = change.kind === "price-down" || change.kind === "restock";
  return <div className="blue-engine-change">
    <p><Link href={`/products/${change.productSlug}`}><strong>{change.productName}</strong></Link><span> · {change.merchantName}</span></p>
    <p><s>{change.before}</s><strong>{change.after}</strong><em className={down ? "down" : "up"}>{change.delta}</em></p>
    <time>{new Date(change.observedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
  </div>;
}

/** 首屏：说清这个站是做什么的，并给出两个页内出口。 */
export function PriceBaselineHero() {
  return <section className="blue-engine" aria-labelledby="hero-title">
    <div className="blue-engine-hero">
      <div className="blue-engine-hero-inner">
        <span className="blue-engine-eyebrow"><i /> 不销售 · 不代收款 · 不替渠道站台</span>
        <h1 id="hero-title"><span>AI 订阅充值与 API 中转</span><span>权威比价平台</span></h1>
        <p>我们替你把散在各家卡网和官网的报价收在一处。想省钱，一眼看出官方价和渠道最低价差多少、这个价现在还买不买得到；还没想好该买订阅、API 还是共享账号，先看清它们的区别和代价，别花钱买错。</p>
        {/* 两个出口都是页内跳转，各自对应下方一节，标签与该节标题一一对应。 */}
        <div className="blue-engine-hero-actions">
          <a className="blue-engine-cta primary" href="#delivery">四种供货方式 <span aria-hidden="true">↓</span></a>
          <a className="blue-engine-cta" href="#baseline">价格对照表 <span aria-hidden="true">↓</span></a>
        </div>
      </div>
    </div>
  </section>;
}

/**
 * 价格表：不要求任何输入，直接给出「现在该花多少钱」的对照结论。
 * 搜索是表格上方的次级工具，不是进入产品的门槛。
 */
export function PriceBaselineTable({ snapshot }: { snapshot: HomeSnapshot }) {
  const { baseline, changes, coverage, placeholder } = snapshot;
  return <section className="blue-engine" aria-labelledby="baseline-title">
    <div className="blue-engine-content">
      {!placeholder && <div className="blue-engine-stats">
        <span><strong>{coverage.verifiedOfferCount}</strong> 条已验证报价</span>
        <span><strong>{coverage.activeSourceCount}</strong> 个活跃来源</span>
        <span><strong>{coverage.officialVendorCount}</strong> 家官方价对照</span>
        <span className="live"><i />随采集持续更新</span>
      </div>}

      <div className="blue-engine-heading" id="baseline">
        <p className="blue-engine-kicker">选价格</p>
        <h2 id="baseline-title">选一个产品，看它现在值多少钱</h2>
        <p>左边是官网原价，右边是渠道当前能买到的最低价，中间标出这个低价是用哪种交付方式换来的。</p>
      </div>
      <div className="blue-engine-toolbar">
        <nav aria-label="按厂商筛选">{BRAND_TABS.map(([label, platform]) => <Link className={platform ? "" : "active"} href={platform ? `/channels?platform=${encodeURIComponent(platform)}` : "/channels"} key={label}>{label}</Link>)}</nav>
        <form className="blue-engine-find" action="/search" method="get">
          <label><SearchIcon /><input name="q" aria-label="查找表内没有的产品" placeholder="表里没有？搜产品名或商家" /></label>
          <button type="submit">查找</button>
        </form>
      </div>

      <p className="blue-engine-legend">{placeholder ? "数据接入中，下表暂不展示具体价格。" : "最低价口径：24 小时内验证过、标记有货、且与官方价同规格的报价。不同交付方式不合并计算。"}</p>

      <div className="blue-engine-table">
        <div className="blue-engine-table-head"><span>标准商品</span><span>官方价（折人民币）</span><span>渠道最低价与交付方式</span><span>价格分布</span><span>有效报价</span><span /></div>
        {baseline.map((row) => <BaselineRowView row={row} placeholder={placeholder} key={row.slug} />)}
      </div>

      <div className="blue-engine-bottom">
        <article className="blue-engine-changes">
          <header><h2>最近 24 小时的降价与补货</h2><Link href="/changes">全部异动 <span>→</span></Link></header>
          {changes.length
            ? changes.map((change) => <ChangeLine change={change} key={`${change.productSlug}-${change.merchantName}-${change.observedAt}`} />)
            : <p className="blue-engine-nodata">这段时间没有记录到价格或库存变化。</p>}
        </article>
        <aside className="blue-engine-guide">
          <span className="blue-engine-guide-label">读表提醒</span>
          <h2>最低价不等于你能买到的价</h2>
          <ol>
            <li><span>01</span>先看交付方式：账号归谁，决定了这个价格值不值。</li>
            <li><span>02</span>再看确认时间：长期没更新的低价通常已经不可买。</li>
            <li><span>03</span>最后回原站核对：价格、库存和售后规则以商家页面为准。</li>
          </ol>
          <Link href="/methodology">我们怎么算最低价 <span>→</span></Link>
        </aside>
      </div>
    </div>
  </section>;
}
