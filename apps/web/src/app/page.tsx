const products = [
  {
    name: "ChatGPT Plus",
    platform: "OpenAI",
    offers: 0,
    price: "等待首轮采集",
    tone: "mint",
  },
  {
    name: "Claude Pro",
    platform: "Anthropic",
    offers: 0,
    price: "等待首轮采集",
    tone: "sand",
  },
  {
    name: "Gemini Pro",
    platform: "Google",
    offers: 0,
    price: "等待首轮采集",
    tone: "sky",
  },
  {
    name: "SuperGrok",
    platform: "xAI",
    offers: 0,
    price: "等待首轮采集",
    tone: "lilac",
  },
];

const capabilities = [
  ["来源可追溯", "保留原始标题、原站链接与最后确认时间"],
  ["库存与新鲜度分离", "采集失败不会被误判成商品缺货"],
  ["同规格再比价", "代充、成品号、共享和反代不会混成一个最低价"],
];

export default function HomePage() {
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
          <span><b>0</b> 已验证报价</span>
          <span><b>0</b> 活跃来源</span>
          <span><b>—</b> 最近发布</span>
        </div>
      </section>

      <section className="section" aria-labelledby="products-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">热门权益</span>
            <h2 id="products-heading">从标准产品开始比较</h2>
          </div>
          <span className="section-note">数据底座建设中</span>
        </div>
        <div className="product-grid">
          {products.map((product) => (
            <article className={`product-card ${product.tone}`} key={product.name}>
              <div className="product-meta">
                <span>{product.platform}</span>
                <span>{product.offers} 条报价</span>
              </div>
              <h3>{product.name}</h3>
              <p className="price-label">最低有效价</p>
              <strong>{product.price}</strong>
              <div className="card-footer">
                <span>仅展示通过校验的报价</span>
                <span aria-hidden="true">↗</span>
              </div>
            </article>
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

