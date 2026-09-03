import { getPublicCatalog, type PublicProductSummary } from "@/lib/public-catalog";
import { getActiveSponsorships } from "@/lib/public-sponsorships";
import Link from "next/link";
import { SiteHeader } from "./site-header";

export const dynamic = "force-dynamic";

const tones = ["mint", "sand", "sky", "lilac"] as const;

const capabilities = [
  ["来源可追溯", "保留原始标题、原站链接与最后确认时间"],
  ["库存与新鲜度分离", "采集失败不会被误判成商品缺货"],
  ["同规格再比价", "代充、成品号、共享和反代不会混成一个最低价"],
];

const purchasePaths = [
  {
    audience: "第一次购买",
    title: "我想开通一个 AI 会员",
    description: "先看官网和应用商店的标准价，再决定是否需要更低价的代充、卡密或成品号。",
    primary: ["先看官方订阅", "/official-prices"],
    secondary: ["比较卡网报价", "/subscriptions"],
  },
  {
    audience: "熟悉卡网",
    title: "我想找现货或更低价方案",
    description: "从标准商品进入，重点核对账号归属、接码、可用端、质保和最后确认时间。",
    primary: ["进入卡网比价", "/subscriptions"],
    secondary: ["查看来源目录", "/channels"],
  },
  {
    audience: "开发接入",
    title: "我需要调用模型 API",
    description: "先用官方 API 建立价格基准，再比较中转站的模型价、可用性和证据来源。",
    primary: ["查看官方 API", "/official-api"],
    secondary: ["比较中转 API", "/api-transit"],
  },
] as const;

const modules = [
  ["01", "卡网订阅", "第三方渠道中的会员、代充、成品号与卡密，重点看同规格最低价、库存和交付方式。", "/subscriptions", "比较卡网报价"],
  ["02", "官方订阅", "官网、App Store 与 Google Play 的地区价、原币价、支付门槛和证据精度。", "/official-prices", "核对官方价格"],
  ["03", "官方 API", "模型厂商公布的输入、缓存、输出、多模态费用与免费层限制。", "/official-api", "建立官方基准"],
  ["04", "中转 API", "第三方网关的公开模型价格、近 7 日监测与一次性自带 Key 检测。", "/api-transit", "比较中转服务"],
] as const;

const faqs = [
  ["平台会代我购买或收款吗？", "不会。平台只整理公开报价和证据，付款、交付、退款与售后都在原站完成。"],
  ["为什么同一个产品价格差很多？", "名称相同不代表规格相同。成品号、自己账号充值、共享、短期体验和反代的成本与风险完全不同。"],
  ["最低价就是最推荐的吗？", "不是。默认排序会优先有效且新鲜的可购买报价，但仍要核对质保、账号归属、接码状态与风险事实。"],
  ["发现价格或库存不对怎么办？", "每条报价都提供举报入口。提交后会进入运营审核，错误数据可被隔离或下架。"],
] as const;

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
  const [catalog, sponsorships] = await Promise.all([getPublicCatalog(), getActiveSponsorships("home_after_hero")]);

  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="eyebrow">公开来源 · 独立核验 · 不参与交易</div>
        <h1>先看清怎么买，<br />再比较多少钱。</h1>
        <p>
          将零散的 AI 订阅、代充、成品号和卡密整理成可比较的权益产品，
          同时保留每条报价的来源、库存与新鲜度。
        </p>
        <div className="hero-actions">
          <a className="primary-cta" href="#paths">先选购买路径</a>
          <Link className="secondary-cta" href="/subscriptions">直接看卡网低价</Link>
        </div>
        <form className="search" action="/search">
          <label className="sr-only" htmlFor="query">搜索 AI 产品或商家</label>
          <input id="query" name="q" placeholder="搜索 ChatGPT Plus、Claude Max、商家…" />
          <button type="submit">搜索</button>
        </form>
        <nav className="hero-quick-search" aria-label="搜索示例">
          <span>热门搜索</span>
          <Link href="/subscriptions?q=ChatGPT+Plus">ChatGPT Plus</Link>
          <Link href="/subscriptions?q=Claude+Pro">Claude Pro</Link>
          <Link href="/subscriptions?q=Google+AI+Pro">Gemini Pro</Link>
          <Link href="/subscriptions?q=SuperGrok">SuperGrok</Link>
          <Link href="/subscriptions?q=Team">Team</Link>
        </nav>
        <div className="status-row">
          <span><b>{catalog.verifiedOfferCount}</b> 已验证报价</span>
          <span><b>{catalog.activeSourceCount}</b> 活跃来源</span>
          <span><b>{formatPublishedAt(catalog.publishedAt)}</b> 最近发布</span>
        </div>
      </section>

      {sponsorships.length > 0 && <aside className="sponsorship-strip" aria-label="赞助内容">{sponsorships.map((item) => <a key={item.id} href={item.destination_url} target="_blank" rel="noopener noreferrer sponsored nofollow"><span>{item.label}</span><b>{item.name}</b><small>{item.disclosure}</small></a>)}</aside>}

      <section className="section path-section" id="paths" aria-labelledby="paths-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">购买路径</span>
            <h2 id="paths-heading">你现在要解决哪一种问题？</h2>
          </div>
          <span className="section-note">先选路径，能避开大多数不可比的低价</span>
        </div>
        <div className="path-grid">
          {purchasePaths.map((path, index) => (
            <article className={index === 0 ? "featured" : undefined} key={path.title}>
              <span className="path-audience">{path.audience}</span>
              <h3>{path.title}</h3>
              <p>{path.description}</p>
              <div className="path-actions">
                <Link href={path.primary[1]}>{path.primary[0]}</Link>
                <Link href={path.secondary[1]}>{path.secondary[0]}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section module-section" aria-labelledby="modules-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">四个频道</span>
            <h2 id="modules-heading">从问题进入对应工具</h2>
          </div>
        </div>
        <div className="module-list">
          {modules.map(([number, title, description, href, action]) => (
            <Link href={href} key={number}>
              <span>{number}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
              <b>{action} <span aria-hidden="true">→</span></b>
            </Link>
          ))}
        </div>
        <div className="brand-rail" aria-label="常见 AI 平台">
          <span>常见平台</span>
          <Link href="/brands/openai">ChatGPT</Link>
          <Link href="/brands/anthropic">Claude</Link>
          <Link href="/brands/google">Gemini</Link>
          <Link href="/brands/xai">Grok</Link>
          <Link href="/official-api">DeepSeek</Link>
          <Link href="/official-api">Qwen</Link>
          <Link href="/official-api">Kimi</Link>
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
            <a className={`product-card ${tones[index] ?? "mint"}`} href={`/products/${product.slug}`} key={product.slug}>
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
            </a>
          ))}
        </div>
      </section>

      <section className="section offers-section" aria-labelledby="offers-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">实时样本</span>
            <h2 id="offers-heading">最新有效报价</h2>
          </div>
          <Link className="section-link" href="/changes">查看价格与库存异动 →</Link>
        </div>
        <div className="offer-list">
          {catalog.offers.length === 0 ? (
            <div className="empty-state">尚无通过完整性、分类和库存校验的报价。</div>
          ) : catalog.offers.map((offer) => (
            <a
              className="offer-row"
              href={`/out/${offer.id}`}
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
        <div className="trust-list">
          {capabilities.map(([title, description], index) => (
            <article key={title}>
              <span className="capability-number">0{index + 1}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="section faq-section" id="faq" aria-labelledby="faq-heading">
        <div className="section-heading">
          <div>
            <span className="section-kicker">买前必读</span>
            <h2 id="faq-heading">先把容易踩坑的地方说清楚</h2>
          </div>
          <Link className="section-link" href="/methodology">查看完整数据说明</Link>
        </div>
        <div className="faq-list">
          {faqs.map(([question, answer], index) => (
            <details key={question} open={index === 0}>
              <summary>{question}<span aria-hidden="true">＋</span></summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <footer>
        <span>AI 价格雷达</span>
        <p>价格仅供参考，交易在第三方原站完成。平台不代收款、不为商家担保。</p>
        <nav aria-label="页脚导航"><Link href="/changes">价格异动</Link><Link href="/methodology">数据说明</Link><Link href="/channels">来源目录</Link><Link href="/status">系统健康</Link><Link href="/submit">提交渠道</Link></nav>
      </footer>
    </main>
  );
}
