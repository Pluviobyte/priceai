import type { PublicOfferDetail } from "@/lib/public-catalog";

const modeLabels: Record<string, string> = {
  recharge: "代充", finished_account: "成品账号", redeem_code: "兑换码",
  team_seat: "团队席位", shared_account: "共享账号", web_mirror: "网页镜像",
  reverse_proxy: "反代", api_credit: "API 额度", short_term: "短期商品", unknown: "待确认",
};
const warrantyLabels: Record<string, string> = {
  none: "无质保", first_login: "仅保首登", fixed_hours: "固定时长质保",
  subscription_period: "订阅期质保", unknown: "质保未知",
};

function formatTime(value: Date | null): string {
  if (!value) return "未确认";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZone: "Asia/Shanghai",
  }).format(value);
}

export function PublicOfferList({ offers, showProduct = false }: { offers: PublicOfferDetail[]; showProduct?: boolean }) {
  if (offers.length === 0) return <div className="empty-state">没有匹配当前条件的有效报价。</div>;
  return (
    <div className="public-offers">
      {offers.map((offer) => (
        <article className="public-offer" key={offer.id}>
          <div className="public-offer-main">
            <div className="review-facts">
              {showProduct ? <a href={`/products/${offer.productSlug}`}>{offer.productName}</a> : null}
              <span>{modeLabels[offer.offerMode] ?? offer.offerMode}</span>
              <span>{warrantyLabels[offer.warrantyType] ?? offer.warrantyType}</span>
              <span>{offer.durationDays ? `${offer.durationDays} 天` : "期限未标注"}</span>
              <span>{offer.stockState === "out_of_stock" ? "缺货" : offer.stockCount === null ? "库存未知" : `库存 ${offer.stockCount}`}</span>
              <span>{offer.freshnessState === "fresh" ? "数据新鲜" : offer.freshnessState}</span>
            </div>
            <h3>{offer.rawTitle}</h3>
            <div className="evidence-line">
              <a href={`/merchants/${offer.merchantSlug}`}>{offer.merchantName}</a>
              <span>原价文本：{offer.rawPriceText}</span>
              <span>确认于 {formatTime(offer.verifiedAt)}</span>
            </div>
            <div className="offer-risk-facts">
              {offer.riskFacts.length ? offer.riskFacts.map((fact) => <em key={fact}>{fact}</em>) : <em className="neutral">未识别到显式风险事实</em>}
            </div>
          </div>
          <div className="public-offer-buy">
            <strong>¥{Number(offer.price).toFixed(2)}</strong>
            <a href={`/out/${offer.id}`} target="_blank" rel="noopener noreferrer nofollow">前往原站 ↗</a>
            <details>
              <summary>举报错误</summary>
              <form action="/api/reports" method="post" className="inline-report-form">
                <input type="hidden" name="targetType" value="offer" />
                <input type="hidden" name="targetId" value={offer.id} />
                <input type="hidden" name="returnTo" value={`/products/${offer.productSlug}`} />
                <select name="reportType" defaultValue="wrong_price">
                  <option value="wrong_price">价格错误</option><option value="out_of_stock">已缺货</option>
                  <option value="delisted">已下架</option><option value="misclassified">分类错误</option>
                </select>
                <textarea name="details" maxLength={1200} placeholder="请说明发现" required />
                <input name="website" className="honeypot" tabIndex={-1} autoComplete="off" />
                <button type="submit">提交举报</button>
              </form>
            </details>
          </div>
        </article>
      ))}
    </div>
  );
}
