import { SiteHeader } from "../site-header";

export default function MerchantFeedPage() {
  const example = { schemaVersion: 1, merchant: { name: "Example" }, items: [{ id: "sku-1", title: "ChatGPT Plus 1 month", price: 99, currency: "CNY", stockCount: 8, stockState: "in_stock", url: "https://merchant.example/products/sku-1", description: "独立账号，30 天质保" }] };
  return <main><SiteHeader active="submit" /><section className="form-shell"><div className="form-intro"><span className="section-kicker">Merchant direct feed</span><h1>商家 Feed 申请</h1><p>提交公开 JSON Feed 后，平台会先做 URL 安全检查、字段校验和限量试采，人工通过后才标记“商家直连数据”。</p></div>
    <form className="public-form" action="/api/feed-submissions" method="post"><label>商家名<input name="merchantName" minLength={2} maxLength={120} required /></label><label>官网 URL<input name="websiteUrl" type="url" maxLength={500} required /></label><label>公开 Feed URL<input name="feedUrl" type="url" maxLength={500} required /></label><label>Schema 类型<select name="schemaKind" defaultValue="price-radar-v1"><option value="price-radar-v1">AI 价格雷达 v1</option><option value="auto">自动识别通用 JSON</option></select></label><label>联系方式<input name="contact" maxLength={200} required /></label><label>备注<textarea name="notes" maxLength={2000} /></label><label className="honeypot">Website<input name="companySite" tabIndex={-1} autoComplete="off" /></label><button type="submit">提交 Feed 申请</button></form>
    <section className="feed-spec"><h2>标准 Feed 示例</h2><p>响应必须是公开 HTTPS JSON；商品 ID 必须稳定，不能用价格或标题作为 ID。</p><pre>{JSON.stringify(example, null, 2)}</pre></section>
  </section></main>;
}
