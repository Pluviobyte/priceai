import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "../site-header";

export const metadata: Metadata = { title: "支持作者 | PriceAI" };

export default function SupportPage() {
  return <div className="priceai-page"><SiteHeader /><main className="priceai-simple-page"><section><span>支持 PriceAI</span><h1>让公开、可核验的 AI 比价继续更新。</h1><p>PriceAI 会持续维护订阅价格、API 定价、渠道来源和稳定性样本。你可以通过反馈数据、分享项目或赞助维护成本来支持它。</p><div className="priceai-simple-actions"><a href="https://github.com/physics-dimension/PriceAI">在 GitHub 关注项目</a><a href="https://t.me/dimthink">联系作者</a></div></section><div className="priceai-support-grid"><article><b>♡</b><h2>提交反馈</h2><p>发现价格、库存、链接或说明过期时，把原始证据发来。</p><Link href="/submit">提交线索　›</Link></article><article><b>⌁</b><h2>分享项目</h2><p>把 PriceAI 分享给需要比较 AI 订阅和 API 成本的人。</p><Link href="/guides">查看入门指南　›</Link></article><article><b>♧</b><h2>赞助维护</h2><p>赞助用于服务器、监测、数据采集与持续开发。</p><a href="https://t.me/dimthink">联系赞助　›</a></article></div></main><footer className="priceai-footer"><nav className="priceai-footer-actions" aria-label="返回首页核心内容"><Link className="priceai-footer-button primary" href="/?home=1#channels">↑　先选购买路径</Link><Link className="priceai-footer-button" href="/?home=1#baseline">↑　直接看全网底价</Link></nav></footer></div>;
}
