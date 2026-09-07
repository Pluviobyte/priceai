import Link from "next/link";
import { ModelIcon, MODEL_ICON_PATHS, type ModelIconName } from "./model-icons";
import { OFFER_MODE_LABEL, type BaselineRow, type HomeSnapshot } from "@/lib/home-snapshot";

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
        : <span className="blue-engine-nodata">暂无同规格近期有货报价</span>}
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

/** 首屏：说清这个站是做什么的，并给出两个页内出口。 */
export function PriceBaselineHero() {
  return <section className="blue-engine" aria-labelledby="hero-title">
    <div className="blue-engine-hero">
      <div className="blue-engine-hero-inner">
        <span className="blue-engine-eyebrow"><i /> 中立比价雷达 · 不销售 · 不代收款 · 不替渠道背书</span>
        <h1 id="hero-title"><span>AI 订阅充值与 API 中转</span><span>实时行情与比价雷达</span></h1>
        <p>汇集全网卡网现货与官网公开报价。一眼看清官方正价与各渠道底价差多少、当前是否能买到；先理清自充、代充、成品号与 API 的真实区别，买前心里有底，不花冤枉钱。</p>
        {/* 两个出口都是页内跳转：主按钮导向购买路径，次按钮导向底价大表 */}
        <div className="blue-engine-hero-actions">
          <a className="blue-engine-cta primary" href="#channels">先选购买路径 <span aria-hidden="true">↓</span></a>
          <a className="blue-engine-cta" href="#baseline">直接看全网底价 <span aria-hidden="true">↓</span></a>
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
  const { baseline, coverage, placeholder } = snapshot;
  return <section className="blue-engine" aria-labelledby="baseline-title">
    <div className="blue-engine-content">
      {!placeholder && <div className="blue-engine-stats">
        <span><strong>{coverage.verifiedOfferCount}</strong> 条已验证报价</span>
        <span><strong>{coverage.activeSourceCount}</strong> 个活跃来源</span>
        <span><strong>{coverage.officialVendorCount}</strong> 家官方价对照</span>
        <span className="live"><i />随采集持续更新</span>
      </div>}

      <div className="blue-engine-heading" id="baseline">
        <p className="blue-engine-kicker">实时比价雷达</p>
        <h2 id="baseline-title">官方原价 vs 渠道底价：一览全网真实行情</h2>
        <p>不用再去各家卡网反复翻找比价。这里直接对照官方汇率正价与渠道最新现货底价，并清楚标注交付方式、来源商家与库存更新时间。</p>
      </div>
      <div className="blue-engine-toolbar">
        <nav aria-label="按厂商筛选">{BRAND_TABS.map(([label, platform]) => <Link className={platform ? "" : "active"} href={platform ? `/channels?platform=${encodeURIComponent(platform)}` : "/channels"} key={label}>{label}</Link>)}</nav>
        <form className="blue-engine-find" action="/search" method="get">
          <label><SearchIcon /><input name="q" aria-label="查找表内没有的产品" placeholder="表里没有？搜产品名或商家" /></label>
          <button type="submit">查找</button>
        </form>
      </div>

      <p className="blue-engine-legend">{placeholder ? "数据暂时读取失败，请稍后重试。" : "最低价口径：24 小时内验证过、标记有货、且与官方价同规格的报价。价格带和有效报价数按最低价对应的交付方式统计；渠道权益和税费可能不同。"}</p>

      {snapshot.warnings?.map(warning => <p key={warning} role="status" className="blue-engine-nodata">{warning}</p>)}
      <div className="blue-engine-table">
        <div className="blue-engine-table-head"><span>标准商品</span><span>官方价（折人民币）</span><span>渠道最低价与交付方式</span><span>价格分布</span><span>有效报价</span><span /></div>
        {baseline.map((row) => <BaselineRowView row={row} placeholder={placeholder} key={row.slug} />)}
      </div>


    </div>
  </section>;
}
