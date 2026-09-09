import styles from "./price-comparison.module.css";

export default function LoadingOfficialPrices() {
  return <main className="priceai-catalog-shell" aria-busy="true">
    <section className="priceai-catalog-hero"><div><p className="priceai-kicker">官方订阅</p><h1>正在加载官方订阅价格</h1><p role="status">正在读取套餐和地区报价，请稍候。你也可以继续使用顶部导航。</p></div></section>
    <div className={styles.loading} aria-hidden="true"><span /><span /><span /><span /></div>
  </main>;
}
