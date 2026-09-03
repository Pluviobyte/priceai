import Link from "next/link";
import type { Metadata } from "next";
import { getProductSummaries, type PublicProductSummary } from "@/lib/public-catalog";
import { SiteHeader } from "../site-header";
import { SiteFooter } from "../site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "卡网订阅比价 | PriceAI",
  description: "PriceAI 聚合 AI 订阅卡网渠道报价，比较标准商品、最低价、库存、质保与渠道更新时间。",
};

function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

function formatPrice(product: PublicProductSummary, price: string | null | undefined): string {
  if (!price) return "暂无价格";
  const amount = Number(price);
  return `${product.currency === "CNY" ? "¥" : `${product.currency ?? ""} `}${amount.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function relative(value: Date | null | undefined): string {
  if (!value) return "未记录";
  const minutes = Math.max(1, Math.round((Date.now() - value.getTime()) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}小时前` : `${Math.round(hours / 24)}天前`;
}

const platformLabels: Record<string, string> = { OpenAI: "ChatGPT", Anthropic: "Claude", Google: "Gemini", xAI: "Grok" };
const familyLabels: Record<string, string> = { subscription: "订阅/会员", account: "成品账号", api: "API/额度", email: "邮箱/账号", phone: "接码/验证", tool: "工具账号" };

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = first(raw.q).trim();
  const platform = first(raw.platform).trim();
  const sort = first(raw.sort) || "recommended";
  const allProducts = await getProductSummaries();
  const query = q.toLocaleLowerCase("zh-CN");
  const products = allProducts.filter((product) => (!platform || product.platform.toLowerCase() === platform.toLowerCase()) && (!query || `${product.name} ${product.platform} ${product.planFamily ?? ""}`.toLocaleLowerCase("zh-CN").includes(query)));
  products.sort((a, b) => sort === "price" ? (Number(a.lowestPrice) || Infinity) - (Number(b.lowestPrice) || Infinity) : sort === "offers" ? (b.totalOfferCount ?? b.offerCount) - (a.totalOfferCount ?? a.offerCount) : b.offerCount - a.offerCount);
  const totalOffers = allProducts.reduce((sum, product) => sum + (product.totalOfferCount ?? product.offerCount), 0);
  const inStock = allProducts.reduce((sum, product) => sum + (product.inStockCount ?? 0), 0);
  const outOfStock = allProducts.reduce((sum, product) => sum + (product.outOfStockCount ?? 0), 0);
  const lastUpdated = allProducts.reduce<Date | null>((latest, product) => !product.latestVerifiedAt ? latest : !latest || product.latestVerifiedAt > latest ? product.latestVerifiedAt : latest, null);

  const filterHref = (nextPlatform: string, nextQuery = q) => {
    const params = new URLSearchParams();
    if (nextQuery) params.set("q", nextQuery);
    if (nextPlatform) params.set("platform", nextPlatform);
    if (sort !== "recommended") params.set("sort", sort);
    return params.size ? `/channels?${params}` : "/channels";
  };

  const categories = [["全部", ""], ["ChatGPT", "OpenAI"], ["Claude", "Anthropic"], ["Gemini", "Google"], ["Grok", "xAI"]] as const;

  return <div className="priceai-page priceai-catalog-page"><SiteHeader active="channels" />
    <nav className="priceai-category-rail" aria-label="按平台筛选">{categories.map(([label,value]) => <Link className={platform === value && !q ? "active" : undefined} href={filterHref(value, "")} key={label}>{label}</Link>)}<Link className={q === "邮箱" ? "active" : undefined} href={filterHref("", "邮箱")}>✉ 邮箱</Link><Link className={q === "接码" ? "active" : undefined} href={filterHref("", "接码")}>◌ 接码</Link><Link className={q === "其他" ? "active" : undefined} href={filterHref("", "其他")}>▱ 其他</Link></nav>
    <main className="priceai-catalog-shell">
      <section className="priceai-catalog-hero"><div><h1>卡网订阅比价</h1><p className="priceai-catalog-meta">最近更新：{relative(lastUpdated)}　·　{allProducts.length} 个商品　·　主价格优先取有货最低价，缺货会明显标注</p><p className="priceai-catalog-intro">PriceAI 聚合 AI 订阅卡网渠道报价。本站不卖货、不担保，价格仅供参考，实际交易和售后规则以原平台为准。</p></div><dl><div><dt>标准商品</dt><dd>{allProducts.length}</dd></div><div><dt>报价</dt><dd>{totalOffers}</dd></div><div><dt>有货</dt><dd>{inStock}</dd></div><div><dt>缺货</dt><dd>{outOfStock}</dd></div></dl></section>
      <aside className="priceai-guide-strip" aria-label="买前指南"><span>▣ 买前指南</span><Link href="/guides/are-ai-subscription-card-shops-reliable">卡网渠道靠谱吗？</Link><b>·</b><Link href="/guides/why-ai-subscription-prices-differ">价格为什么差很多？</Link><b>·</b><Link href="/guides/chatgpt-subscription-options">ChatGPT 获取方式</Link><b>·</b><small>下单前先核验原店铺的交付、售后和投诉入口。</small><Link className="priceai-guide-button" href="/guides">入门指南 →</Link></aside>
      <div className="priceai-catalog-toolbar"><form action="/channels"><label className="sr-only" htmlFor="catalog-query">搜索标准商品</label><input id="catalog-query" name="q" defaultValue={q} placeholder="搜索标准商品，如 ChatGPT Plus、Gemini Pro、邮箱" /><button type="submit">⌕　筛选</button>{platform && <input type="hidden" name="platform" value={platform} />}</form><nav aria-label="订阅频道视图"><Link className="active" href="/channels">◈ 标准商品</Link><Link href="/channels?view=offers">▤ 全部报价</Link><Link href="/channels?view=merchants">▱ 卡网商家</Link><Link className="apply" href="/submit">▱ 申请收录</Link></nav></div>
      <div className="priceai-catalog-status"><span>{products.length} 个匹配商品</span><label>排序 <select defaultValue={sort} name="sort"><option value="recommended">推荐</option><option value="price">价格最低</option><option value="offers">报价最多</option></select></label>{(q || platform || sort !== "recommended") && <Link href="/channels">清空全部条件</Link>}</div>
      {products.length ? <div className="priceai-data-table-wrap"><table className="priceai-data-table"><thead><tr><th>标准商品</th><th>平台</th><th>类型</th><th>最低价</th><th>质保最低价</th><th>库存</th><th>渠道</th><th>最低渠道</th><th>最近更新</th><th>操作</th></tr></thead><tbody>{products.map(product => <tr key={product.slug}><td><Link href={`/products/${product.slug}`}><b>{product.name}</b><small>{product.planFamily ?? "标准商品"}</small></Link></td><td>{platformLabels[product.platform] ?? product.platform}</td><td>{familyLabels[product.planFamily ?? ""] ?? product.planFamily ?? "其他"}</td><td><Link href={`/products/${product.slug}`}><strong>{formatPrice(product, product.lowestPrice)}</strong><em className={product.lowestPrice ? "stock" : "sold"}>{product.lowestPrice ? "有货" : "缺货"}</em></Link></td><td><Link href={`/products/${product.slug}`}><strong>{product.warrantyLowestPrice ? formatPrice(product, product.warrantyLowestPrice) : "–"}</strong>{product.warrantyLowestPrice && <em className="warranty">质保</em>}</Link></td><td><span className="stock-count">有货 {product.inStockCount ?? 0}</span><span className="sold-count">缺货 {product.outOfStockCount ?? 0}</span></td><td>{product.totalOfferCount ?? product.offerCount}</td><td><b>{product.lowestMerchantName ?? "未记录"}</b><small>{product.lowestRawTitle ?? "暂无原始商品名"}</small></td><td>{relative(product.latestVerifiedAt)}</td><td><Link className="priceai-row-button" href={`/products/${product.slug}`}>查看　›</Link></td></tr>)}</tbody></table></div> : <div className="empty-state">没有匹配的标准商品，请尝试其他关键词或平台。</div>}
      <p className="priceai-catalog-disclaimer">价格仅供参考，实际价格、库存和售后规则以原平台为准。本工具不构成购买建议。</p>
    </main><SiteFooter />
  </div>;
}
