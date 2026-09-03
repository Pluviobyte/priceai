import type { ReactNode } from "react";
import Link from "next/link";

const sections = [
  ["入门必读", [["AI 订阅价格为什么差很多", "why-ai-subscription-prices-differ"], ["官方地区价风险", "ai-subscription-region-price-risks"]]],
  ["官方订阅", [["如何自己完成官方订阅", "how-to-subscribe-ai-officially"], ["Apple ID 订阅 AI", "apple-id-ai-subscription"], ["Google Play 订阅 AI", "google-play-ai-subscription"]]],
  ["支付方式", [["订阅 AI 需要什么支付卡", "visa-card-for-ai-subscription"], ["AI 订阅礼品卡限制", "ai-subscription-gift-card"]]],
  ["平台指南", [["卡网渠道靠谱吗", "are-ai-subscription-card-shops-reliable"], ["ChatGPT 获取方式", "chatgpt-subscription-options"], ["API 中转站怎么比较", "api-transit"], ["怎么自己搭一个自用 API 中转站", "self-host-api-transit"]]],
] as const;

export function GuideShell({ children, toc = [] }: { children: ReactNode; toc?: Array<{ id: string; label: string }> }) {
  return <main className="priceai-docs"><aside className="priceai-doc-sidebar"><div className="priceai-doc-brand"><Link href="/">⌕　PriceAI</Link><span>▣</span></div><div className="priceai-doc-search">⌕　Search <kbd>⌘ K</kbd></div><nav><Link className="active" href="/guides">快速入门</Link>{sections.map(([title, links]) => <section key={title}><b>{title}<span>⌄</span></b>{links.map(([label, slug]) => <Link href={`/guides/${slug}`} key={slug}>{label}</Link>)}</section>)}</nav><div className="priceai-doc-social"><button type="button">☾</button><button type="button">◯</button><a href="https://t.me/priceaicc">◈</a><a href="https://github.com/physics-dimension/PriceAI">●</a></div></aside><div className="priceai-doc-canvas"><article className="priceai-doc-article">{children}</article><aside className="priceai-doc-toc"><h3>☰　On this page</h3>{toc.map((item) => <a href={`#${item.id}`} key={item.id}>{item.label}</a>)}</aside></div></main>;
}

export function GuideCards({ items }: { items: Array<{ href: string; title: string; text: string }> }) {
  return <div className="priceai-doc-cards">{items.map((item) => <Link href={item.href} key={item.href}><span>▣</span><h3>{item.title}</h3><p>{item.text}</p></Link>)}</div>;
}
