import Link from "next/link";
import { ModelIcon, type ModelIconName } from "./model-icons";

const products = [
  {
    icon: "openai" as ModelIconName,
    tone: "green",
    name: "ChatGPT Plus",
    spec: "1 个月 · 个人",
    official: "¥142.6",
    officialNote: "US$20 官网",
    lowest: "¥75.9",
    discount: "−47%",
    lowestNote: "代充 · 订阅期质保",
    rangeStart: "14%",
    rangeWidth: "58%",
    rangeMin: "¥29.9 共享",
    rangeMax: "¥142.6 官方",
    offers: "23",
    vendors: "9 家有货",
  },
  {
    icon: "claude" as ModelIconName,
    tone: "orange",
    name: "Claude Pro",
    spec: "1 个月 · 个人",
    official: "¥142.6",
    officialNote: "US$20 官网",
    lowest: "¥98",
    discount: "−31%",
    lowestNote: "成品号 · 仅保首登",
    rangeStart: "40%",
    rangeWidth: "50%",
    rangeMin: "¥98",
    rangeMax: "¥142.6 官方",
    offers: "17",
    vendors: "6 家有货",
  },
  {
    icon: "gemini" as ModelIconName,
    tone: "blue",
    name: "Google AI Pro",
    spec: "1 个月 · 个人",
    official: "¥141.5",
    officialNote: "US$19.99 官网",
    lowest: "¥39.9",
    discount: "−72%",
    lowestNote: "兑换码 · 需海外邮箱",
    rangeStart: "8%",
    rangeWidth: "40%",
    rangeMin: "¥39.9",
    rangeMax: "¥141.5 官方",
    offers: "12",
    vendors: "5 家有货",
  },
  {
    icon: "grok" as ModelIconName,
    tone: "black",
    name: "SuperGrok",
    spec: "1 个月 · 个人",
    official: "¥213.9",
    officialNote: "US$30 官网",
    lowest: "¥129",
    discount: "−40%",
    lowestNote: "代充 · 无质保",
    rangeStart: "30%",
    rangeWidth: "50%",
    rangeMin: "¥129",
    rangeMax: "¥213.9 官方",
    offers: "9",
    vendors: "3 家有货",
  },
] as const;

const categories = ["全部", "ChatGPT", "Claude", "Gemini", "Grok"];

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16.5 16.5 4 4" /></svg>;
}

function PriceRow({ product }: { product: (typeof products)[number] }) {
  return <div className="blue-engine-row">
    <div className="blue-engine-product"><span className={`blue-engine-mark ${product.tone}`}><ModelIcon name={product.icon} label={product.name} /></span><div><strong>{product.name}</strong><small>{product.spec}</small></div></div>
    <div className="blue-engine-official"><strong>{product.official}</strong><small>{product.officialNote}</small></div>
    <div className="blue-engine-lowest"><div><strong>{product.lowest}</strong><span>{product.discount}</span></div><small>{product.lowestNote}</small></div>
    <div className="blue-engine-range"><div className="blue-engine-range-track"><span className="blue-engine-range-fill" style={{ left: product.rangeStart, width: product.rangeWidth }} /><i className="min" style={{ left: product.rangeStart }} /><i className="max" /></div><small><span>{product.rangeMin}</span><span>{product.rangeMax}</span></small></div>
    <div className="blue-engine-offers"><strong>{product.offers}</strong><small>{product.vendors}</small></div>
    <Link className="blue-engine-view" href="/channels">看报价</Link>
  </div>;
}

export function BluePriceEngine() {
  return <section className="blue-engine" aria-labelledby="blue-engine-title">
    <div className="blue-engine-hero">
      <div className="blue-engine-hero-inner">
        <span className="blue-engine-eyebrow"><i /> AI 订阅比价引擎</span>
        <h1 id="blue-engine-title">AI 会员到底该花多少钱？</h1>
        <p>输入产品名，一屏看到官方价、卡网最低价和它们之间的差别在哪。</p>
        <form className="blue-engine-search" action="/channels" method="get">
          <label><SearchIcon /><input name="q" aria-label="搜索 AI 产品" placeholder="例如 ChatGPT Plus、Claude Pro、GPT-4o API…" /></label>
          <select name="duration" aria-label="订阅周期" defaultValue="1m"><option value="1m">1 个月</option><option value="3m">3 个月</option><option value="1y">1 年</option></select>
          <button type="submit">立即比价</button>
        </form>
        <div className="blue-engine-hot"><span>热门：</span>{products.map((product) => <Link href="/channels" key={product.name}>{product.name}</Link>)}<Link href="/channels">ChatGPT Team</Link></div>
      </div>
    </div>

    <div className="blue-engine-content">
      <div className="blue-engine-stats"><span><strong>128</strong> 已验证报价</span><span><strong>14</strong> 活跃来源</span><span><strong>4</strong> 家官方价对照</span><span className="live"><i />持续更新中</span></div>
      <div className="blue-engine-toolbar"><nav aria-label="产品筛选">{categories.map((category, index) => <Link className={index === 0 ? "active" : ""} href="/channels" key={category}>{category}</Link>)}</nav><p>最低价 = 有效、可买、同规格；灰色为官方价</p></div>
      <div className="blue-engine-table">
        <div className="blue-engine-table-head"><span>标准商品</span><span>官方价（折人民币）</span><span>卡网最低价</span><span>价格分布</span><span>有效报价</span><span /></div>
        {products.map((product) => <PriceRow product={product} key={product.name} />)}
      </div>

      <div className="blue-engine-bottom">
        <article className="blue-engine-changes">
          <header><h2>过去 24 小时的降价与补货</h2><Link href="/channels">全部异动 <span>→</span></Link></header>
          <div className="blue-engine-change"><p><strong>ChatGPT Plus</strong><span> · 星河数卡</span></p><p><s>¥79</s><strong>¥75.9</strong><em className="down">↓ ¥3.1</em></p><time>21:10</time></div>
          <div className="blue-engine-change"><p><strong>Claude Pro</strong><span> · 极客卡券</span></p><p><s>缺货</s><strong>有货 8</strong><em className="down">补货</em></p><time>18:42</time></div>
          <div className="blue-engine-change"><p><strong>SuperGrok</strong><span> · AI 优选</span></p><p><s>¥119</s><strong>¥129</strong><em className="up">↑ ¥10</em></p><time>09:15</time></div>
        </article>
        <aside className="blue-engine-guide">
          <span className="blue-engine-guide-label">购买前必读</span>
          <h2>为什么低价不一定能买</h2>
          <ol><li><span>01</span>成品号、代充、共享、反代是 4 种不同的东西。</li><li><span>02</span>每条报价都应核对原站链接、库存和最后确认时间。</li><li><span>03</span>平台不收款、不担保，付款和售后都在商家原站。</li></ol>
          <Link href="/guides">2 分钟读懂比价规则 <span>→</span></Link>
        </aside>
      </div>
      <a className="blue-engine-continue" href="#paths"><span>继续了解 PriceAI</span><strong>选择适合你的购买路径</strong><i>↓</i></a>
    </div>
  </section>;
}
