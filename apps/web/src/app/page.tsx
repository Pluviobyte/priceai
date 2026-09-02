import { getPublicCatalog, type PublicProductSummary } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

const tones = ["mint", "sand", "sky", "lilac"] as const;

const capabilities = [
  ["来源可追溯", "保留原始标题、原站链接与最后确认时间"],
  ["库存与新鲜度分离", "采集失败不会被误判成商品缺货"],
  ["同规格再比价", "代充、成品号、共享和反代不会混成一个最低价"],
];

const modeLabels: Record<string, string> = {
  recharge: "代充",
  finished_account: "成品账号",
  redeem_code: "兑换码",
  team_seat: "团队席位",
  shared_account: "共享账号",
  web_mirror: "网页镜像",
  reverse_proxy: "反代",
  api_credit: "API 额度",
  short_term: "短期商品",
  unknown: "待确认",
};

function formatPrice(product: PublicProductSummary): string {
  if (!product.lowestPrice) return "暂无有效报价";
  const amount = Number(product.lowestPrice);
  const symbol = product.currency === "CNY" ? "¥" : `${product.currency ?? ""} `;
  return `${symbol}${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
}

function formatPublishedAt(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Shanghai",
  }).format(value);
}

export default async function HomePage() {
  const catalog = await getPublicCatalog();

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="AI 价格雷达首页">
          <span className="brand-mark">A</span>
          <span>AI 价格雷达</span>
        </a>
        <nav aria-label="主导航">
          <a className="active" href="/">卡网订阅</a>
          <a href="/official-prices">官方订阅</a>
          <a href="/official-api">官方 API</a>
          <a href="/api-transit">中转 API</a>
        </nav>
        <a className="submit-link" href="/channels">提交渠道</a>
      </header>

      <section className="hero">
        <div className="eyebrow">公开来源 · 独立核验 · 不参与交易</div>
        <h1>先看清怎么买，<br />再比较多少钱。</h1>
        <p>
          将零散的 AI 订阅、代充、成品号和卡密整理成可比较的权益产品，
          同时保留每条报价的来源、库存与新鲜度。
        </p>
        <form className="search" action="/search">
          <label className="sr-only" htmlFor="query">搜索 AI 产品或商家</label>
          <input id="query" name="q" placeholder="搜索 ChatGPT Plus、Claude Max、商家…" />
          <button type="submit">搜索</button>
        </form>
        <div className="status-row">
          <span><b>{catalog.verifiedOfferCount}</b> 已验证报价</span>
          <span><b>{catalog.activeSourceCount}</b> 活跃来源</span>
          <span><b>{formatPublishedAt(catalog.publishedAt)}</b> 最近发布</span>
        </div>
      </section>

      <section className="section" aria-labelledby="products-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">热门权益</span>
            <h2 id="products-heading">从标准产品开始比较</h2>
          </div>
          <span className="section-note">仅统计可购买且通过校验的报价</span>
        </div>
        <div className="product-grid">
          {catalog.products.map((product, index) => (
            <article className={`product-card ${tones[index] ?? "mint"}`} key={product.slug}>
              <div className="product-meta">
                <span>{product.platform}</span>
                <span>{product.offerCount} 条报价</span>
              </div>
              <h3>{product.name}</h3>
              <p className="price-label">最低有效价</p>
              <strong>{formatPrice(product)}</strong>
              <div className="card-footer">
                <span>库存、规格与来源均已核验</span>
                <span aria-hidden="true">↗</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section offers-section" aria-labelledby="offers-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">实时样本</span>
            <h2 id="offers-heading">最新有效报价</h2>
          </div>
          <span className="section-note">点击后前往第三方原站</span>
        </div>
        <div className="offer-list">
          {catalog.offers.length === 0 ? (
            <div className="empty-state">尚无通过完整性、分类和库存校验的报价。</div>
          ) : catalog.offers.map((offer) => (
            <a
              className="offer-row"
              href={offer.productUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              key={offer.id}
            >
              <span className="offer-product">
                <b>{offer.productName}</b>
                <small>{offer.merchantName}</small>
              </span>
              <span className="offer-tags">
                <em>{modeLabels[offer.offerMode] ?? offer.offerMode}</em>
                <em>{offer.stockCount === null ? "库存未知" : `库存 ${offer.stockCount}`}</em>
                {offer.riskFacts.slice(0, 1).map((risk) => (
                  <em className="risk" key={risk}>{risk}</em>
                ))}
              </span>
              <strong>¥{Number(offer.price).toFixed(2)}</strong>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </div>
      </section>

      <section className="section trust-section" aria-labelledby="trust-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">数据承诺</span>
            <h2 id="trust-heading">每个数字都能回到原始证据</h2>
          </div>
        </div>
        <div className="capability-grid">
          {capabilities.map(([title, description], index) => (
            <article key={title}>
              <span className="capability-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <span>AI 价格雷达</span>
        <p>价格仅供参考，交易在第三方原站完成。平台不代收款、不为商家担保。</p>
      </footer>
    </main>
  );
}
