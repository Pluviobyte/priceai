import { notFound } from "next/navigation";
import { getPublicProduct, type OfferFilters } from "@/lib/public-catalog";
import { getOfficialReferencePrice } from "@/lib/public-pricing";
import { PublicOfferList } from "../../public-offer-list";
import { SiteHeader } from "../../site-header";
import { ShareLink } from "../../share-link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug, {});
  return product ? { title: `${product.name} 比价 | AI 价格雷达`, description: `比较 ${product.name} 的价格、库存、交付方式、质保和原始证据。`, alternates: { canonical: `/products/${product.slug}` } } : { title: "产品未找到" };
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const raw = await searchParams;
  const q = first(raw.q);
  const mode = first(raw.mode);
  const warranty = first(raw.warranty);
  const ownership = first(raw.ownership);
  const shared = first(raw.shared);
  const phone = first(raw.phone);
  const sort = first(raw.sort);
  const duration = Number(first(raw.duration));
  const minPrice = Number(first(raw.minPrice));
  const maxPrice = Number(first(raw.maxPrice));
  const filters: OfferFilters = {
    ...(q ? { q } : {}),
    ...(mode ? { mode } : {}),
    ...(warranty ? { warranty } : {}),
    ...(ownership ? { ownership } : {}),
    ...(first(raw.stock) === "all" ? { stock: "all" as const } : { stock: "available" as const }),
    ...(shared === "yes" || shared === "no" ? { shared } : {}),
    ...(phone === "yes" || phone === "no" ? { phoneBound: phone } : {}),
    ...(Number.isInteger(duration) && duration > 0 ? { durationDays: duration } : {}),
    ...(Number.isFinite(minPrice) && minPrice >= 0 && first(raw.minPrice) !== undefined && first(raw.minPrice) !== "" ? { minPrice } : {}),
    ...(Number.isFinite(maxPrice) && maxPrice >= 0 && first(raw.maxPrice) !== undefined && first(raw.maxPrice) !== "" ? { maxPrice } : {}),
    ...(sort === "price" || sort === "freshness" || sort === "stock" ? { sort } : { sort: "default" as const }),
  };
  const product = await getPublicProduct(slug, filters);
  if (!product) notFound();
  const official = await getOfficialReferencePrice(slug);
  const lowestCny = product.offers.find((offer) => offer.currency === "CNY");
  const discount = official?.cnyEstimate && lowestCny
    ? (1 - Number(lowestCny.price) / Number(official.cnyEstimate)) * 100
    : null;
  return (
    <main>
      <SiteHeader active="subscriptions" />
      <section className="detail-hero">
        <div className="breadcrumb-row"><a className="breadcrumb" href="/subscriptions">← 返回卡网订阅</a><a className="breadcrumb" href={`/brands/${product.brand.toLowerCase()}`}>{product.brand} 产品</a></div>
        <h1>{product.name}</h1>
        <p>{product.planFamily} · {product.baseDurationDays ? `标准 ${product.baseDurationDays} 天` : "按原站规格"}</p>
        <div className="detail-summary" aria-label="商品报价概况">
          <span><b>{product.offers.length}</b> 条当前匹配</span>
          <span><b>{product.offers.filter((offer) => offer.stockState !== "out_of_stock").length}</b> 条可购买</span>
          <span><b>{product.publishedAt ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(product.publishedAt) : "未发布"}</b> 最近发布</span>
        </div>
      </section>
      <div className="detail-guide-wrap">
        <aside className="guide-strip detail-guide" aria-label="商品比价提示">
          <div><span>比较提示</span><b>先筛交付方式，再比较价格</b></div>
          <p>低价可能来自短期号、共享或首登质保，购买前务必查看原始标题与风险事实。</p>
          <a href="/methodology">了解排序规则</a>
        </aside>
        <nav className="quick-filters" aria-label="常用报价筛选">
          <a href={`/products/${product.slug}`}>全部可购买</a>
          <a href={`/products/${product.slug}?mode=recharge`}>自己账号代充</a>
          <a href={`/products/${product.slug}?mode=finished_account`}>成品账号</a>
          <a href={`/products/${product.slug}?warranty=subscription_period`}>订阅期质保</a>
          <a href={`/products/${product.slug}?sort=freshness`}>最新确认</a>
        </nav>
      </div>
      <section className="detail-layout">
        <aside className="filter-panel">
          <h2>筛选报价</h2>
          <form method="get">
            <label>关键字<input name="q" defaultValue={first(raw.q)} placeholder="原始标题或商家" /></label>
            <label>交付方式<select name="mode" defaultValue={first(raw.mode) ?? ""}><option value="">全部</option><option value="recharge">代充</option><option value="finished_account">成品账号</option><option value="redeem_code">兑换码</option><option value="team_seat">团队席位</option><option value="shared_account">共享</option><option value="reverse_proxy">反代</option></select></label>
            <label>质保<select name="warranty" defaultValue={first(raw.warranty) ?? ""}><option value="">全部</option><option value="subscription_period">订阅期质保</option><option value="fixed_hours">固定时长</option><option value="first_login">仅保首登</option><option value="none">无质保</option></select></label>
            <label>账号归属<select name="ownership" defaultValue={first(raw.ownership) ?? ""}><option value="">全部</option><option value="buyer">买家自有</option><option value="merchant">商家提供</option><option value="shared">共享</option></select></label>
            <label>库存<select name="stock" defaultValue={first(raw.stock) ?? "available"}><option value="available">仅可购买</option><option value="all">包含缺货/过期</option></select></label>
            <div className="price-range-fields"><label>最低价<input name="minPrice" type="number" min="0" step="0.01" defaultValue={first(raw.minPrice)} placeholder="不限" /></label><label>最高价<input name="maxPrice" type="number" min="0" step="0.01" defaultValue={first(raw.maxPrice)} placeholder="不限" /></label></div>
            <label>排序<select name="sort" defaultValue={first(raw.sort) ?? "default"}><option value="default">默认可比排序</option><option value="price">价格从低到高</option><option value="stock">库存从多到少</option><option value="freshness">最新确认</option></select></label>
            <button type="submit">应用筛选</button>
            <a href={`/products/${product.slug}`}>清空条件</a>
          </form>
        </aside>
        <div className="detail-content">
          {official && <aside className="official-reference"><div><span className="section-kicker">官方价对照</span><b>{official.planName} · {official.countryCode} {official.channel}</b><small>核验于 {new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium" }).format(official.verifiedAt)}</small></div><div><strong>{official.currency} {Number(official.amount).toFixed(2)}</strong>{official.cnyEstimate && <span>约 ¥{Number(official.cnyEstimate).toFixed(2)}</span>}{discount !== null && Number.isFinite(discount) && <em>当前最低 CNY 报价约低 {discount.toFixed(1)}%</em>}<a href={official.evidenceUrl} target="_blank" rel="noopener noreferrer nofollow">官方证据 ↗</a></div></aside>}
          <div className="detail-heading"><div><span className="section-kicker">可比报价</span><h2>{product.offers.length} 条结果</h2></div><div><span>库存与新鲜度分开判定</span><ShareLink title={product.name} /></div></div>
          <PublicOfferList offers={product.offers} />
          <section className="alert-panel">
            <div><span className="section-kicker">价格监测</span><h2>降价或补货时通知我</h2><p>邮箱确认后才会启用，通知失败会持久化重试。</p></div>
            <form action="/api/alerts" method="post">
              <input type="hidden" name="productSlug" value={product.slug} />
              <input type="hidden" name="filters" value={JSON.stringify(filters)} />
              <select name="alertType" defaultValue="price_drop"><option value="price_drop">低于目标价</option><option value="restock">重新补货</option></select>
              <input name="targetPrice" type="number" min="0.01" max="1000000" step="0.01" placeholder="目标价（补货可留空）" />
              <input name="email" type="email" maxLength={320} placeholder="you@example.com" required />
              <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" />
              <button type="submit">创建提醒</button>
            </form>
          </section>
          <section className="history-section">
            <span className="section-kicker">变化记录</span><h2>价格与库存历史</h2>
            {product.history.length ? <div className="history-table-wrap"><table><thead><tr><th>时间</th><th>商家</th><th>价格</th><th>库存</th></tr></thead><tbody>{product.history.map((row, index) => <tr key={`${row.offerId}:${row.observedAt.toISOString()}:${index}`}><td>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(row.observedAt)}</td><td>{row.merchantName}</td><td>{row.currency} {Number(row.price).toFixed(2)}</td><td>{row.stockState}{row.stockCount === null ? "" : ` · ${row.stockCount}`}</td></tr>)}</tbody></table></div> : <div className="empty-state">暂无变价或库存变化记录。</div>}
          </section>
        </div>
      </section>
    </main>
  );
}
