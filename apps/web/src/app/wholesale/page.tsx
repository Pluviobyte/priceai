import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "批发合作 | PriceAI" };

export default function WholesalePage() {
  return <div className="priceai-page"><main className="priceai-simple-page"><section><span>批发合作</span><h1>让稳定的渠道和真实需求更容易找到彼此。</h1><p>适用于 AI 订阅、开发者工具、API 服务与配套基础设施的批量采购或长期合作。PriceAI 不参与交易，只提供公开信息入口与合作联系。</p><div className="priceai-simple-actions"><Link href="/submit">提交合作信息</Link><a href="https://t.me/dimthink">联系合作　›</a></div></section><div className="priceai-support-grid"><article><b>▤</b><h2>明确商品边界</h2><p>提供标准商品、交付方式、数量区间、有效期和售后范围。</p></article><article><b>♧</b><h2>公开核验资料</h2><p>准备官网、价格页、联系方式和可验证的运营主体信息。</p></article><article><b>⌁</b><h2>需求对接</h2><p>说明采购频率、预算区间、交付时效与合同发票要求。</p></article></div></main></div>;
}
