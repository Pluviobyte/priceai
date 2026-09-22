import Link from "next/link";
import { MerchantIcon } from "./merchant-icon";
import type { ChannelCatalog, ChannelRow } from "@/lib/channel-catalog";
import { CHANNEL_PLATFORMS, channelTime } from "@/lib/channel-filters";
import styles from "./channels.module.css";

function shopUrl(value: string | null) {
  try {
    const url = new URL(value ?? "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

function Identity({ row }: { row: ChannelRow }) {
  const url = shopUrl(row.merchant_host);
  return <div className={styles.product}><MerchantIcon source={row.merchant_host} name={row.merchant_name} /><div>
    <Link href={`/merchants/${row.merchant_slug}`} prefetch={false}><b>{row.merchant_name}</b></Link>
    <small>{url ? `${url.host}${url.pathname === "/" ? "" : url.pathname}` : "来源待确认"}</small>
  </div></div>;
}

function Coverage({ row }: { row: ChannelRow }) {
  return <div className={styles.merchantCoverage}>{(row.merchant_platforms ?? []).map(platform => <span key={platform}>{CHANNEL_PLATFORMS.find(([value]) => value === platform)?.[1] ?? platform}</span>)}</div>;
}

function Score({ row, field }: { row: ChannelRow; field: "lowest_count" | "top_five_count" }) {
  return <>{row.comparable_count ? `${row[field] ?? 0} / ${row.comparable_count}` : "暂无可比规格"}</>;
}

function Actions({ row }: { row: ChannelRow }) {
  const url = shopUrl(row.merchant_host);
  return <div className={styles.merchantActions}><Link className={styles.button} href={`/merchants/${row.merchant_slug}`} prefetch={false}>查看报价 →</Link>
    {url && <a className={styles.textLink} href={url.href} target="_blank" rel="noopener noreferrer nofollow" aria-label={`前往 ${row.merchant_name} 原店铺`}>进店 ↗</a>}
  </div>;
}

export function MerchantResults({ data, layout }: { data: ChannelCatalog; layout: "cards" | "table" }) {
  if (layout === "table") return <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="卡网商家表，可横向滚动"><table className={`${styles.table} ${styles.merchantTable}`}>
    <caption className="sr-only">符合筛选条件的商家、商品覆盖和同规格低价表现</caption>
    <thead><tr><th scope="col">商家 / 覆盖模型</th><th scope="col">商品 / 报价</th><th scope="col">已确认有货</th><th scope="col">最低价规格</th><th scope="col">前五价规格</th><th scope="col">最近核验（北京时间）</th><th scope="col">操作</th></tr></thead>
    <tbody>{data.rows.map(row => <tr key={row.id}><td><Identity row={row} /><Coverage row={row} /></td><td>{row.merchant_count} 款 / {row.offer_count} 条</td><td>{row.available_count} 条</td><td><Score row={row} field="lowest_count" /></td><td><Score row={row} field="top_five_count" /></td><td>{channelTime(row.verified_at)}</td><td><Actions row={row} /></td></tr>)}</tbody>
  </table></div>;
  return <ul className={styles.merchantGrid} aria-label="卡网商家列表">{data.rows.map(row => <li className={styles.merchantCard} key={row.id}>
    <div className={styles.merchantCardHeader}><Identity row={row} /><span className={row.available_count > 0 ? styles.available : styles.badge}>{row.available_count > 0 ? "有货报价" : "暂无确认有货"}</span></div>
    <Coverage row={row} />
    <p className={styles.merchantProducts}>{(row.merchant_products ?? []).slice(0, 3).join(" · ")}{(row.merchant_products?.length ?? 0) > 3 ? ` 等 ${row.merchant_count} 款商品` : ""}</p>
    <dl className={styles.merchantStats}><div><dt>涉及商品</dt><dd>{row.merchant_count}<small>款</small></dd></div><div><dt>匹配报价</dt><dd>{row.offer_count}<small>条</small></dd></div><div><dt>已确认有货</dt><dd>{row.available_count}<small>条</small></dd></div></dl>
    <div className={styles.merchantScores}><span>最低价规格 <b><Score row={row} field="lowest_count" /></b></span><span>前五价规格 <b><Score row={row} field="top_five_count" /></b></span></div>
    <div className={styles.merchantCardFooter}><span>核验 · {channelTime(row.verified_at)}</span><Actions row={row} /></div>
  </li>)}</ul>;
}
