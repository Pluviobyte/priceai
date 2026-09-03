import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProduct, type OfferFilters, type PublicOfferDetail } from "@/lib/public-catalog";
import { SiteHeader } from "../../site-header";
import { SiteFooter } from "../../site-footer";

export const dynamic = "force-dynamic";

const platformNames: Record<string, string> = { OpenAI: "ChatGPT", Anthropic: "Claude", Google: "Gemini", xAI: "Grok" };
const familyNames: Record<string, string> = { subscription: "订阅会员", account: "成品账号", api: "API 额度", email: "邮箱账号", phone: "接码验证", tool: "工具账号" };

function first(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }

function relative(value: Date | null): string {
  if (!value) return "未记录";
  const minutes = Math.max(1, Math.round((Date.now() - value.getTime()) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}小时前` : `${Math.round(hours / 24)}天前`;
}

function stockLabel(offer: PublicOfferDetail): string {
  return offer.stockState === "out_of_stock" ? "缺货" : "有货";
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublicProduct(slug, { stock: "all" });
  return product ? { title: `${product.name} 价格对比：渠道报价 | PriceAI`, description: `比较 ${product.name} 的渠道价格、库存、原始商品名和更新时间。`, alternates: { canonical: `/products/${product.slug}` } } : { title: "产品未找到 | PriceAI" };
}

export default async function ProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const raw = await searchParams;
  const q = first(raw.q);
  const mode = first(raw.mode);
  const warranty = first(raw.warranty);
  const sort = first(raw.sort);
  const filters: OfferFilters = {
    ...(q ? { q } : {}),
    ...(mode ? { mode } : {}),
    ...(warranty ? { warranty } : {}),
    ...(first(raw.stock) === "all" ? { stock: "all" as const } : { stock: "available" as const }),
    ...(sort === "freshness" || sort === "price" || sort === "stock" ? { sort } : { sort: "default" as const }),
  };
  const [product, allProduct] = await Promise.all([getPublicProduct(slug, filters), getPublicProduct(slug, { stock: "all" })]);
  if (!product || !allProduct) notFound();
  const offers = product.offers.slice(0, 30);
  const available = allProduct.offers.filter((offer) => offer.stockState !== "out_of_stock").length;
  const latest = allProduct.offers.reduce<Date | null>((current, offer) => !offer.verifiedAt ? current : !current || offer.verifiedAt > current ? offer.verifiedAt : current, null);
  const platform = platformNames[product.brand] ?? product.brand;
  const family = familyNames[product.planFamily] ?? product.planFamily;

  return <div className="priceai-page priceai-product-page"><SiteHeader active="subscriptions" /><main className="priceai-product-shell"><Link className="priceai-product-back" href="/channels">←　返回卡网订阅</Link><section className="priceai-product-hero"><div className="priceai-product-tags"><span>{platform}</span><span>{family}</span><span>{product.billingPeriod === "month" ? "月付" : "普通账号"}</span></div><h1>{product.name}</h1><p>{product.name}、{family}及各渠道公开报价。下单前请核验原始商品名、交付方式和售后规则。</p></section><section className="priceai-product-heading"><div><h2>渠道报价表</h2><p>{allProduct.offers.length} 条报价 · {available} 有货 · 按有货优先和低价排序</p></div><span>◷　最近记录 {relative(latest)}</span></section><nav className="priceai-product-filters" aria-label="报价快捷筛选"><Link href={`/products/${product.slug}`}>▽　筛选</Link><span>{product.offers.length} 条报价</span><Link href={`/products/${product.slug}?sort=stock`}>♧　库存 ≥50</Link><Link href={`/products/${product.slug}?sort=freshness`}>◷　1小时内更新</Link><Link href={`/products/${product.slug}?mode=finished_account`}>已接码</Link><Link href={`/products/${product.slug}?mode=finished_account&phone=no`}>未接码</Link><Link href={`/products/${product.slug}?warranty=subscription_period`}>长期质保</Link></nav>{offers.length ? <div className="priceai-product-table-wrap"><table className="priceai-product-table"><thead><tr><th>库存</th><th>渠道</th><th>原始商品名</th><th>价格</th><th>更新时间</th><th>风险</th><th>操作</th><th>反馈</th></tr></thead><tbody>{offers.map((offer) => <tr key={offer.id}><td><em className={offer.stockState === "out_of_stock" ? "sold" : "stock"}>{stockLabel(offer)}</em><small>{offer.stockCount === null ? "库存未知" : `库存 ${offer.stockCount}`}</small></td><td><Link href={`/merchants/${offer.merchantSlug}`}><span className="priceai-merchant-mark">{offer.merchantName.slice(0, 1)}</span><span><b>{offer.merchantName}</b><small>{offer.sourceId.slice(0, 16)}</small></span></Link></td><td><b>{offer.rawTitle}</b><small>{offer.durationDays ? `${offer.durationDays} 天` : "按原站规格"} · {offer.warrantyType === "subscription_period" ? "订阅期质保" : offer.warrantyHours ? `质保 ${offer.warrantyHours} 小时` : "售后见原站"}</small></td><td><strong>{offer.currency === "CNY" ? "¥" : `${offer.currency} `}{Number(offer.price).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</strong>{offer.durationDays && <small>{offer.durationDays}天</small>}</td><td>{relative(offer.verifiedAt)}</td><td><div className="priceai-product-risks">{offer.riskFacts.slice(0, 2).map((fact) => <em key={fact}>{fact}</em>)}</div></td><td><a className="priceai-row-button" href={`/out/${offer.id}`} target="_blank" rel="noopener noreferrer nofollow">前往购买　↗</a></td><td><details><summary>{offer.riskFacts.length ? `${offer.riskFacts.length} 条` : "⚑"}</summary><form action="/api/reports" method="post"><input type="hidden" name="targetType" value="offer" /><input type="hidden" name="targetId" value={offer.id} /><input type="hidden" name="returnTo" value={`/products/${product.slug}`} /><select name="reportType" defaultValue="wrong_price"><option value="wrong_price">价格错误</option><option value="out_of_stock">已缺货</option><option value="delisted">已下架</option></select><textarea name="details" placeholder="请说明发现的问题" required /><button type="submit">提交</button></form></details></td></tr>)}</tbody></table></div> : <div className="empty-state">没有匹配当前条件的有效报价。</div>}{product.offers.length > offers.length && <Link className="priceai-product-load" href={`/products/${product.slug}?stock=all`}>继续加载报价（{offers.length}/{product.offers.length}）</Link>}<aside className="priceai-product-guide"><div><small>买前指南</small><b>想先弄清 {platform} 各种获取方式？</b><p>可以先看平台价格页和新手指南，再回到这里核验具体渠道报价。</p></div><nav><Link href={`/brands/${product.brand.toLowerCase()}`}>平台页　›</Link><Link href="/guides/chatgpt-subscription-options">指南　›</Link></nav></aside><p className="priceai-product-disclaimer">免责声明：本站仅聚合公开采集或审核通过的报价信息，不参与交易。实际价格、库存、质保和售后规则以原平台为准。</p></main><SiteFooter /></div>;
}
