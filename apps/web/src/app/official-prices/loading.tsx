import Link from "next/link";
import styles from "./price-comparison.module.css";

export default function LoadingOfficialPrices() {
  return <div className="priceai-page priceai-catalog-page priceai-official-page">
    <nav className="priceai-category-rail" aria-label="按产品筛选">{[["全部", ""], ["ChatGPT", "openai"], ["Claude", "anthropic"], ["Gemini", "google"], ["Grok", "xai"]].map(([label, vendor]) => <Link key={label} href={vendor ? `/official-prices?vendor=${vendor}` : "/official-prices"} prefetch={false}>{label}</Link>)}</nav>
    <main className="priceai-catalog-shell" aria-busy="true">
      <section className="priceai-catalog-hero priceai-official-hero"><div>
        <p className="priceai-kicker">官方订阅</p><h1>先看官方价，再决定在哪里买</h1>
        <p className="priceai-catalog-intro">把官网、iOS Store 与 Google Play 的公开标价放到同一张表里。先确认套餐、地区和支付门槛，再比较第三方渠道，避免只盯最低价买错交付方式。</p>
      </div></section>
      <span className="sr-only" role="status">正在读取官方订阅价格</span>
      <div className={styles.loading} aria-hidden="true"><span /><span /><span /><span /></div>
    </main>
  </div>;
}
