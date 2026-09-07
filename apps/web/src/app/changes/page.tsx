import type { Metadata } from "next";
import Link from "next/link";
import { getPublicMarketChanges } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "价格与库存异动 | AI 价格雷达",
  description: "查看 AI 订阅公开报价在最近 24 小时、7 天或 30 天内的价格与库存变化。",
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatMoney(currency: string, value: string): string {
  const amount = Number(value);
  return `${currency === "CNY" ? "¥" : `${currency} `}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function stockLabel(state: string, count: number | null): string {
  const stateLabels: Record<string, string> = { in_stock: "有货", low_stock: "库存紧张", out_of_stock: "缺货", unknown: "库存未知", conflict: "状态冲突" };
  return count === null ? stateLabels[state] ?? state : `${stateLabels[state] ?? state} ${count}`;
}

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const periodValue = first(raw.period);
  const days: 1 | 7 | 30 = periodValue === "1" ? 1 : periodValue === "30" ? 30 : 7;
  const kind = first(raw.kind) || "all";
  const allChanges = await getPublicMarketChanges(days);
  const changes = allChanges.filter((change) => {
    const priceChanged = Number(change.price) !== Number(change.previousPrice);
    const stockChanged = change.stockCount !== change.previousStockCount || change.stockState !== change.previousStockState;
    return kind === "price" ? priceChanged : kind === "stock" ? stockChanged : true;
  });
  const priceChangeCount = allChanges.filter((change) => Number(change.price) !== Number(change.previousPrice)).length;
  const stockChangeCount = allChanges.filter((change) => change.stockCount !== change.previousStockCount || change.stockState !== change.previousStockState).length;
  const periodHref = (period: string) => `/changes?period=${period}${kind !== "all" ? `&kind=${kind}` : ""}`;
  const kindHref = (nextKind: string) => `/changes?period=${days}${nextKind !== "all" ? `&kind=${nextKind}` : ""}`;

  return (
    <main>

      <section className="listing-shell changes-shell">
        <div className="channel-title-row">
          <div><span className="section-kicker">Market movement</span><h1>价格与库存异动</h1><p className="listing-lead">只展示同一条公开报价前后两次观测发生的变化。它用于发现降价与补货，不代表平台推荐购买。</p></div>
          <dl className="channel-stats"><div><dt>发生异动</dt><dd>{allChanges.length}</dd></div><div><dt>价格变化</dt><dd>{priceChangeCount}</dd></div><div><dt>库存变化</dt><dd>{stockChangeCount}</dd></div></dl>
        </div>
        <aside className="guide-strip"><div><span>怎么看</span><b>先看变化，再核对当前商品规格</b></div><p>价格下降可能伴随交付方式、时长或质保调整，进入商品页后再做同规格比较。</p><Link href="/methodology">查看数据口径</Link></aside>
        <div className="change-controls">
          <nav className="view-switch" aria-label="时间范围"><Link className={days === 1 ? "active" : undefined} href={periodHref("1")}>24 小时</Link><Link className={days === 7 ? "active" : undefined} href={periodHref("7")}>7 天</Link><Link className={days === 30 ? "active" : undefined} href={periodHref("30")}>30 天</Link></nav>
          <nav className="view-switch" aria-label="异动类型"><Link className={kind === "all" ? "active" : undefined} href={kindHref("all")}>全部</Link><Link className={kind === "price" ? "active" : undefined} href={kindHref("price")}>价格</Link><Link className={kind === "stock" ? "active" : undefined} href={kindHref("stock")}>库存</Link></nav>
        </div>
        <div className="catalog-status"><span>{changes.length} 条匹配异动</span><span>每个报价仅展示所选周期内最近一次变化</span><Link href="/subscriptions">返回订阅比价</Link></div>
        {changes.length ? <div className="changes-list">{changes.map((change) => {
          const delta = Number(change.price) - Number(change.previousPrice);
          const priceChanged = delta !== 0;
          const stockChanged = change.stockCount !== change.previousStockCount || change.stockState !== change.previousStockState;
          return <article key={change.offerId}>
            <div className="change-identity"><Link href={`/products/${change.productSlug}`}>{change.productName}</Link><Link href={`/merchants/${change.merchantSlug}`}>{change.merchantName}</Link></div>
            <div className="change-facts">{priceChanged && <span><small>价格</small><s>{formatMoney(change.currency, change.previousPrice)}</s><b>{formatMoney(change.currency, change.price)}</b><em className={delta < 0 ? "down" : "up"}>{delta < 0 ? "↓" : "↑"}{formatMoney(change.currency, String(Math.abs(delta)))}</em></span>}{stockChanged && <span><small>库存</small><s>{stockLabel(change.previousStockState, change.previousStockCount)}</s><b>{stockLabel(change.stockState, change.stockCount)}</b></span>}</div>
            <time>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(change.observedAt)}</time>
            <Link className="row-action" href={`/products/${change.productSlug}`}>核对报价</Link>
          </article>;
        })}</div> : <div className="empty-state">所选周期内暂无匹配异动。可切换时间范围或查看当前报价。</div>}
      </section>
    </main>
  );
}
