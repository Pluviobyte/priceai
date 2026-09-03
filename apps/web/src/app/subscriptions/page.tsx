import Link from "next/link";
import type { Metadata } from "next";
import { getProductSummaries, getPublicCatalog, type PublicProductSummary } from "@/lib/public-catalog";
import { SiteHeader } from "../site-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "卡网订阅比价 | AI 价格雷达",
  description: "按标准商品比较 AI 订阅、成品号、充值和卡密的有效报价、库存与质保。",
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatPrice(product: PublicProductSummary, price: string | null | undefined): string {
  if (!price) return "暂无";
  const amount = Number(price);
  const symbol = product.currency === "CNY" ? "¥" : `${product.currency ?? ""} `;
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatPublishedAt(value: Date | null): string {
  if (!value) return "尚未发布";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(value);
}

const platformLabels: Record<string, string> = {
  OpenAI: "ChatGPT",
  Anthropic: "Claude",
  Google: "Gemini",
  xAI: "Grok",
};

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const platform = first(raw.platform).trim();
  const minPrice = Number(first(raw.minPrice));
  const maxPrice = Number(first(raw.maxPrice));
  const hasMinPrice = Number.isFinite(minPrice) && minPrice >= 0 && first(raw.minPrice) !== "";
  const hasMaxPrice = Number.isFinite(maxPrice) && maxPrice >= 0 && first(raw.maxPrice) !== "";
  const sort = first(raw.sort) || "recommended";
  const [allProducts, catalog] = await Promise.all([getProductSummaries(), getPublicCatalog()]);
  const platforms = [...new Set(allProducts.map((product) => product.platform))];
  const query = q.toLocaleLowerCase("zh-CN");
  const products = allProducts.filter((product) => {
    const matchesPlatform = !platform || product.platform.toLocaleLowerCase("zh-CN") === platform.toLocaleLowerCase("zh-CN");
    const matchesQuery = !query || `${product.name} ${product.platform}`.toLocaleLowerCase("zh-CN").includes(query);
    const price = product.lowestPrice === null ? null : Number(product.lowestPrice);
    const matchesMin = !hasMinPrice || (price !== null && price >= minPrice);
    const matchesMax = !hasMaxPrice || (price !== null && price <= maxPrice);
    return matchesPlatform && matchesQuery && matchesMin && matchesMax;
  });
  products.sort((a, b) => {
    if (sort === "price") return (a.lowestPrice === null ? Number.POSITIVE_INFINITY : Number(a.lowestPrice)) - (b.lowestPrice === null ? Number.POSITIVE_INFINITY : Number(b.lowestPrice));
    if (sort === "warranty") return (a.warrantyLowestPrice == null ? Number.POSITIVE_INFINITY : Number(a.warrantyLowestPrice)) - (b.warrantyLowestPrice == null ? Number.POSITIVE_INFINITY : Number(b.warrantyLowestPrice));
    if (sort === "offers") return b.offerCount - a.offerCount;
    return Number(b.offerCount > 0) - Number(a.offerCount > 0) || b.offerCount - a.offerCount;
  });
  const offerCount = allProducts.reduce((sum, product) => sum + product.offerCount, 0);
  const pricedProductCount = allProducts.filter((product) => product.lowestPrice).length;

  const filterHref = (nextPlatform: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (hasMinPrice) params.set("minPrice", String(minPrice));
    if (hasMaxPrice) params.set("maxPrice", String(maxPrice));
    if (sort !== "recommended") params.set("sort", sort);
    if (nextPlatform) params.set("platform", nextPlatform);
    const suffix = params.toString();
    return suffix ? `/subscriptions?${suffix}` : "/subscriptions";
  };

  return (
    <main>
      <SiteHeader active="subscriptions" />
      <div className="platform-rail" aria-label="按平台筛选">
        <Link className={!platform ? "active" : undefined} href={filterHref("")}>全部</Link>
        {platforms.map((item) => (
          <Link
            className={platform.toLocaleLowerCase("zh-CN") === item.toLocaleLowerCase("zh-CN") ? "active" : undefined}
            href={filterHref(item)}
            key={item}
          >
            {platformLabels[item] ?? item}
          </Link>
        ))}
      </div>

      <section className="listing-shell subscription-shell">
        <div className="channel-title-row">
          <div>
            <span className="section-kicker">Card shop subscriptions</span>
            <h1>卡网订阅比价</h1>
            <p className="listing-lead">先按标准商品聚合，再进入详情比较交付方式、库存、质保、风险事实和原始渠道。</p>
          </div>
          <dl className="channel-stats" aria-label="卡网订阅数据概况">
            <div><dt>标准商品</dt><dd>{allProducts.length}</dd></div>
            <div><dt>有效报价</dt><dd>{offerCount}</dd></div>
            <div><dt>当前有价</dt><dd>{pricedProductCount}</dd></div>
            <div><dt>活跃来源</dt><dd>{catalog.activeSourceCount}</dd></div>
          </dl>
        </div>

        <aside className="guide-strip" aria-label="购买前提示">
          <div><span>买前提示</span><b>最低价不一定是同一种商品</b></div>
          <p>成品号、自己账号充值、共享与反代必须分开比较，进入详情后再按需求筛选。</p>
          <Link href="/methodology">查看比价口径</Link>
        </aside>

        <div className="catalog-toolbar">
          <form className="catalog-filter-form" action="/subscriptions">
            <label className="sr-only" htmlFor="subscription-query">搜索标准商品或平台</label>
            <input id="subscription-query" name="q" defaultValue={q} placeholder="搜索 ChatGPT Plus、Claude、Gemini…" />
            {platform && <input type="hidden" name="platform" value={platform} />}
            <label><span>最低价</span><input name="minPrice" type="number" min="0" step="0.01" defaultValue={hasMinPrice ? minPrice : undefined} placeholder="不限" /></label>
            <label><span>最高价</span><input name="maxPrice" type="number" min="0" step="0.01" defaultValue={hasMaxPrice ? maxPrice : undefined} placeholder="不限" /></label>
            <label><span>排序</span><select name="sort" defaultValue={sort}><option value="recommended">推荐</option><option value="price">价格最低</option><option value="warranty">有质保最低</option><option value="offers">报价最多</option></select></label>
            <button type="submit">应用</button>
          </form>
          <nav className="view-switch" aria-label="订阅频道视图">
            <Link className="active" href="/subscriptions">标准商品</Link>
            <Link href="/channels">卡网商家</Link>
            <Link href="/submit">申请收录</Link>
          </nav>
        </div>

        <nav className="quick-filters" aria-label="常搜订阅">
          <span>试试：</span>
          <Link href="/subscriptions?q=ChatGPT+Plus">ChatGPT Plus</Link>
          <Link href="/subscriptions?q=Claude+Pro">Claude Pro</Link>
          <Link href="/subscriptions?q=Google+AI+Pro">Gemini Pro</Link>
          <Link href="/subscriptions?q=SuperGrok">SuperGrok</Link>
          <Link href="/subscriptions?q=Team">Team</Link>
        </nav>

        <div className="catalog-status">
          <span>{products.length} 个匹配商品</span>
          <span>最近发布 {formatPublishedAt(catalog.publishedAt)}</span>
          {(q || platform || hasMinPrice || hasMaxPrice || sort !== "recommended") ? <Link href="/subscriptions">清空全部条件</Link> : <span>默认只把有效、可购买报价计入最低价</span>}
        </div>

        {products.length ? (
          <div className="subscription-table-wrap">
            <table className="subscription-table">
              <thead>
                <tr>
                  <th>标准商品</th>
                  <th>平台</th>
                  <th>最低有效价</th>
                  <th>有质保最低</th>
                  <th>报价</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.slug}>
                    <td data-label="标准商品"><Link href={`/products/${product.slug}`}><b>{product.name}</b><small>同规格报价聚合</small></Link></td>
                    <td data-label="平台"><span className="platform-pill">{platformLabels[product.platform] ?? product.platform}</span></td>
                    <td data-label="最低有效价"><strong>{formatPrice(product, product.lowestPrice)}</strong><small>{product.lowestPrice ? "可购买" : "等待有效报价"}</small></td>
                    <td data-label="有质保最低"><strong>{formatPrice(product, product.warrantyLowestPrice)}</strong></td>
                    <td data-label="报价"><b>{product.offerCount}</b><small>条有效报价</small></td>
                    <td data-label="操作"><Link className="row-action" href={`/products/${product.slug}`}>查看报价</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">没有匹配的标准商品，请尝试其他关键词或平台。</div>
        )}
      </section>
    </main>
  );
}
