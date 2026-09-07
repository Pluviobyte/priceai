import { searchPublicOffers } from "@/lib/public-catalog";
import { PublicOfferList } from "../public-offer-list";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const offers = await searchPublicOffers(q, { stock: "available" });
  return <main><section className="listing-shell"><span className="section-kicker">全站搜索</span><h1>{q ? `“${q}” 的结果` : "搜索产品、原始标题或商家"}</h1><form className="search" action="/search"><input name="q" defaultValue={q} placeholder="ChatGPT Plus、Claude Max、商家…" /><button type="submit">搜索</button></form><div className="detail-heading"><span>{offers.length} 条可购买报价</span></div><PublicOfferList offers={offers} showProduct /></section></main>;
}
