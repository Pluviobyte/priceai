import { notFound } from "next/navigation";
import { getPublicProduct, type OfferFilters } from "@/lib/public-catalog";
import { PublicOfferList } from "../../public-offer-list";
import { SiteHeader } from "../../site-header";

export const dynamic = "force-dynamic";

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
  const filters: OfferFilters = {
    ...(q ? { q } : {}),
    ...(mode ? { mode } : {}),
    ...(warranty ? { warranty } : {}),
    ...(ownership ? { ownership } : {}),
    ...(first(raw.stock) === "all" ? { stock: "all" as const } : { stock: "available" as const }),
    ...(shared === "yes" || shared === "no" ? { shared } : {}),
    ...(phone === "yes" || phone === "no" ? { phoneBound: phone } : {}),
    ...(Number.isInteger(duration) && duration > 0 ? { durationDays: duration } : {}),
    ...(sort === "price" || sort === "freshness" ? { sort } : { sort: "default" as const }),
  };
  const product = await getPublicProduct(slug, filters);
  if (!product) notFound();
  return (
    <main>
      <SiteHeader />
      <section className="detail-hero">
        <a className="breadcrumb" href={`/brands/${product.brand.toLowerCase()}`}>{product.brand}</a>
        <h1>{product.name}</h1>
        <p>{product.planFamily} · {product.baseDurationDays ? `标准 ${product.baseDurationDays} 天` : "按原站规格"}</p>
      </section>
      <section className="detail-layout">
        <aside className="filter-panel">
          <h2>筛选报价</h2>
          <form method="get">
            <label>关键字<input name="q" defaultValue={first(raw.q)} placeholder="原始标题或商家" /></label>
            <label>交付方式<select name="mode" defaultValue={first(raw.mode) ?? ""}><option value="">全部</option><option value="recharge">代充</option><option value="finished_account">成品账号</option><option value="redeem_code">兑换码</option><option value="team_seat">团队席位</option><option value="shared_account">共享</option><option value="reverse_proxy">反代</option></select></label>
            <label>质保<select name="warranty" defaultValue={first(raw.warranty) ?? ""}><option value="">全部</option><option value="subscription_period">订阅期质保</option><option value="fixed_hours">固定时长</option><option value="first_login">仅保首登</option><option value="none">无质保</option></select></label>
            <label>账号归属<select name="ownership" defaultValue={first(raw.ownership) ?? ""}><option value="">全部</option><option value="buyer">买家自有</option><option value="merchant">商家提供</option><option value="shared">共享</option></select></label>
            <label>库存<select name="stock" defaultValue={first(raw.stock) ?? "available"}><option value="available">仅可购买</option><option value="all">包含缺货/过期</option></select></label>
            <label>排序<select name="sort" defaultValue={first(raw.sort) ?? "default"}><option value="default">默认可比排序</option><option value="price">价格从低到高</option><option value="freshness">最新确认</option></select></label>
            <button type="submit">应用筛选</button>
            <a href={`/products/${product.slug}`}>清空条件</a>
          </form>
        </aside>
        <div className="detail-content">
          <div className="detail-heading"><div><span className="section-kicker">可比报价</span><h2>{product.offers.length} 条结果</h2></div><span>库存与新鲜度分开判定</span></div>
          <PublicOfferList offers={product.offers} />
          <section className="history-section">
            <span className="section-kicker">变化记录</span><h2>价格与库存历史</h2>
            {product.history.length ? <div className="history-table-wrap"><table><thead><tr><th>时间</th><th>商家</th><th>价格</th><th>库存</th></tr></thead><tbody>{product.history.map((row, index) => <tr key={`${row.offerId}:${row.observedAt.toISOString()}:${index}`}><td>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(row.observedAt)}</td><td>{row.merchantName}</td><td>{row.currency} {Number(row.price).toFixed(2)}</td><td>{row.stockState}{row.stockCount === null ? "" : ` · ${row.stockCount}`}</td></tr>)}</tbody></table></div> : <div className="empty-state">暂无变价或库存变化记录。</div>}
          </section>
        </div>
      </section>
    </main>
  );
}
