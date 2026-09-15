import { FavoriteButton } from "../../favorite-button";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMerchantIdentity, getPublicMerchantListing } from "@/lib/public-catalog";
import { PublicOfferList } from "../../public-offer-list";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantIdentity(slug);
  return merchant ? { title: `${merchant.name} 报价与健康度 | AI 价格雷达`, description: `查看 ${merchant.name} 的 AI 订阅报价、来源健康度和最后成功采集时间。`, alternates: { canonical: `/merchants/${merchant.slug}` } } : { title: "商家未找到" };
}

function date(value: Date | null): string { return value ? new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(value) : "—"; }

export default async function MerchantPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const raw = await searchParams;
  const merchant = await getPublicMerchantListing(slug, Number(Array.isArray(raw.page) ? raw.page[0] : raw.page));
  if (!merchant) notFound();
  const pages = Math.max(1, Math.ceil(merchant.total / merchant.pageSize));
  return <main><section className="detail-hero merchant-hero"><span className="section-kicker">商家详情</span><h1>{merchant.name}</h1><FavoriteButton kind="merchant" slug={merchant.slug} /><p>{merchant.commercialRelation === "none" ? "无商业关系" : `商业关系：${merchant.commercialRelation}`} · 价格排序不因付费改变</p><dl className="merchant-facts"><div><dt>采集健康</dt><dd>{merchant.healthStatus}</dd></div><div><dt>系统</dt><dd>{merchant.collectorKind}</dd></div><div><dt>首次发现</dt><dd>{date(merchant.firstSeenAt)}</dd></div><div><dt>最后成功</dt><dd>{date(merchant.lastSuccessAt)}</dd></div></dl>{merchant.websiteUrl ? <a className="primary-link" href={merchant.websiteUrl} target="_blank" rel="noopener noreferrer nofollow">访问店铺 ↗</a> : null}</section><section className="listing-shell compact"><div className="detail-heading"><div><span className="section-kicker">当前报价</span><h2>{merchant.total} 条</h2></div></div><PublicOfferList offers={merchant.offers} showProduct />
    {pages > 1 && <nav className="priceai-product-filters" aria-label="商家报价分页">
      {merchant.page > 1 && <Link href={`/merchants/${merchant.slug}?page=${merchant.page - 1}`}>← 上一页</Link>}
      <span>第 {merchant.page} / {pages} 页 · 每页最多 {merchant.pageSize} 条</span>
      {merchant.page < pages && <Link href={`/merchants/${merchant.slug}?page=${merchant.page + 1}`}>下一页 →</Link>}
    </nav>}<form className="merchant-report" action="/api/reports" method="post"><h2>纠错、投诉或退出收录</h2><input type="hidden" name="targetType" value="merchant" /><input type="hidden" name="targetId" value={merchant.id} /><input type="hidden" name="returnTo" value={`/merchants/${merchant.slug}`} /><select name="reportType" aria-label="纠错或投诉类型"><option value="merchant_unreachable">商家失联</option><option value="misleading_description">说明失实</option><option value="merchant_info_update">商家信息修正</option><option value="merchant_opt_out">申请退出收录</option></select><textarea name="details" maxLength={1200} required placeholder="请说明情况和可核实的证据" /><input name="evidenceUrl" type="url" maxLength={2048} placeholder="证据链接（选填）" /><input name="website" className="honeypot" tabIndex={-1} autoComplete="off" /><button type="submit">提交处理</button></form></section></main>;
}
