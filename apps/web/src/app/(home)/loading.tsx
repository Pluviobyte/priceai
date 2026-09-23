import { PriceBaselineHero } from "../blue-price-engine";

/** The hero is static, so a click on 首页 shows it at once while the price table is read. */
export default function Loading() {
  return <div className="priceai-page"><main className="priceai-home" aria-busy="true">
    <PriceBaselineHero />
    <section className="blue-engine" aria-label="价格表">
      <div className="blue-engine-content">
        <span className="sr-only" role="status">正在读取价格表</span>
        <div className="blue-engine-table" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map(row => <div className="blue-engine-row blue-engine-skeleton" key={row}><span /><span /><span /><span /></div>)}
        </div>
      </div>
    </section>
  </main></div>;
}
