import type { ReactNode } from "react";
import Link from "next/link";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { BluePriceEngine } from "./blue-price-engine";
import { ModelIcon, type ModelIconName } from "./model-icons";

const paths = [
  { icon: "shield", label: "订阅新手", title: "我只是想买一个 AI 订阅", text: "先看官方价、地区价和支付门槛；如果需要现货、更低价或代开通，再去看卡网订阅。", primary: ["先看官方订阅", "/official-prices"], secondary: ["再看卡网订阅", "/channels"] },
  { icon: "money", label: "资深买家", title: "我想找更低价或更灵活的方案", text: "先看卡网订阅里的低价现货、渠道和更新时间；如果要接 GPT、Claude、Gemini、Grok 等模型，再看中转 API。", primary: ["看卡网订阅", "/channels"], secondary: ["看中转 API", "/api-transit"] },
  { icon: "database", label: "开发接入", title: "我想接 API 做产品或工具", text: "先看 DeepSeek、千问、Kimi、GLM 等官方 API 的免费额度、Token Plan 和限制；再对比中转 API。", primary: ["比较官方 API", "/official-api"], secondary: ["查看中转 API", "/api-transit"] },
] as const;

const modules = [
  { icon: "package", title: "卡网订阅", text: "第三方渠道里的 AI 会员、账号、邮箱、卡密、CDK、Kiro 等，重点看有货价和交付方式。", href: "/channels" },
  { icon: "badge", title: "官方订阅", text: "ChatGPT、Claude、Gemini、Grok 等会员的官网正价、地区价、资格价和支付门槛。", href: "/official-prices" },
  { icon: "database", title: "官方 API", text: "DeepSeek、千问、Kimi、GLM 等国产模型官方 API，包含免费额度、Token Plan 和限制。", href: "/official-api" },
  { icon: "key", title: "中转 API", text: "面向 GPT、Claude、Gemini、Grok 等模型的第三方中转站，重点看倍率、稳定性和披露信息。", href: "/api-transit" },
] as const;

const modelFamilies: Array<{ icon: ModelIconName; label: string }> = [
  { icon: "openai", label: "ChatGPT" },
  { icon: "claude", label: "Claude" },
  { icon: "gemini", label: "Gemini" },
  { icon: "grok", label: "Grok" },
  { icon: "deepseek", label: "DeepSeek" },
  { icon: "qwen", label: "Qwen" },
  { icon: "kimi", label: "Kimi" },
  { icon: "zhipu", label: "GLM" },
];

const faqs = [
  ["PriceAI 是卖 AI 订阅的吗？", "不是。PriceAI 不卖货、不收款、不参与交易，只聚合购买前可以核验的价格、来源、库存、更新时间和原始链接。"],
  ["这些渠道靠谱吗？", "渠道只是信息源。你可以在卡网完成交付，也可以联系店主转到闲鱼等第三方平台交易；无论哪种方式，都要回到原平台确认商品描述、售后规则和最终价格。"],
  ["如何买到适合自己的订阅？", "先确定你要官方账号、自己账号开通、成品号还是团队席位。新手优先看官方订阅和指南，准备走第三方渠道时建议先小额试单，不要只看最低价。"],
  ["如何尽量避免被骗？", "看店铺是否有联系方式、售后入口、Telegram 群或售后群，群是否活跃；再看商品数量、历史经营痕迹、描述是否清楚，金额较大时优先选择可投诉或可担保的平台。"],
  ["买到异常商品或疑似被骗怎么办？", "先联系店铺售后；售后无响应时，去对应卡网平台投诉。之后可以回到 PriceAI，在商品右侧点击举报并补充证据，审核通过后会下架异常商品或渠道。"],
] as const;

function LineIcon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const glyphs: Record<string, ReactNode> = {
    shield: <><path d="M20 13c0 5-3.5 7.5-7.7 9C8 20.5 4 18 4 13V6c3 0 6-1.5 8-3 2 1.5 5 3 8 3z" /><path d="m9 12 2 2 4-4" /></>, money: <><circle cx="12" cy="12" r="9" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6" /></>, database: <><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.7 4 3 9 3M21 5v3M3 12c0 1.7 4 3 9 3M21 12l-3 5h4l-3 5" /></>, package: <><path d="M12 22V12M3.3 7 12 12l8.7-5M4 6l7-4a2 2 0 0 1 2 0l7 4a2 2 0 0 1 1 1.7v3.4M3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0" /><path d="m16 17 2 2 4-4" /></>, badge: <><path d="M3.9 8.6a4 4 0 0 1 4.7-4.7 4 4 0 0 1 6.8 0 4 4 0 0 1 4.7 4.7 4 4 0 0 1 0 6.8 4 4 0 0 1-4.7 4.7 4 4 0 0 1-6.8 0 4 4 0 0 1-4.7-4.7 4 4 0 0 1 0-6.8z" /><path d="m9 12 2 2 4-4" /></>, key: <><path d="M2.6 17.4A2 2 0 0 0 2 18.8V21h4v-1a1 1 0 0 1 1-1h2v-2h2.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4z" /><circle cx="16.5" cy="7.5" r=".5" fill="currentColor" /></>, clipboard: <><rect x="4" y="4" width="16" height="18" rx="2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></>, question: <><path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2z" /><path d="M9 10a3 3 0 1 1 4 2.8c-1 .4-1 1.2-1 2M12 18h.01" /></>,
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" {...common} aria-hidden="true">{glyphs[name]}</svg>;
}

function Arrow() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14m-7-7 7 7-7 7" /></svg>; }

export default function HomePage() {
  return <div className="priceai-page"><SiteHeader /><main className="priceai-home">
    <BluePriceEngine />
    <section className="priceai-hero-section"><div className="priceai-container priceai-hero"><p className="priceai-kicker">PriceAI</p><h1><span>AI 低价卡网订阅</span><span>与中转 API 比价雷达</span></h1><p className="priceai-lead">PriceAI 把官方订阅、卡网订阅、官方 API 和中转 API 放在同一个入口里。你先选择购买路径，再进入对应页面比较价格、来源、库存和更新时间。</p><div className="priceai-hero-actions"><a className="priceai-btn primary" href="#paths">先选购买路径 <Arrow /></a><Link className="priceai-btn" href="/channels">直接看有货低价</Link></div></div>
      <div className="priceai-container priceai-paths" id="paths"><div className="priceai-section-heading compact"><p className="priceai-kicker">购买路径</p><h2>先回答一个问题：你现在要买什么？</h2><p>首页只负责分流。具体价格、库存、来源和购买链接，回到对应工具页完成。</p></div><div className="priceai-path-grid">{paths.map((item) => <article key={item.title}><div className="priceai-card-top"><span className="priceai-icon"><LineIcon name={item.icon} /></span><span className="priceai-pill">{item.label}</span></div><h3>{item.title}</h3><p>{item.text}</p><div className="priceai-card-actions"><Link className="priceai-btn primary" href={item.primary[1]}>{item.primary[0]} <Arrow /></Link><Link className="priceai-btn" href={item.secondary[1]}>{item.secondary[0]}</Link></div></article>)}</div></div></section>
    <section className="priceai-module-section"><div className="priceai-container"><div className="priceai-section-heading"><p className="priceai-kicker">四个模块</p><h2>选完路径，再进入对应工具。</h2><p>新手按购买问题走，老用户可以直接进入熟悉的模块。</p></div><div className="priceai-module-grid">{modules.map((item) => <Link href={item.href} key={item.title}><div><span className="priceai-icon"><LineIcon name={item.icon} /></span><Arrow /></div><h3>{item.title}</h3><p>{item.text}</p></Link>)}</div><div className="priceai-brand-title">覆盖常见 AI 订阅、模型与开发者入口</div><div className="priceai-brand-grid">{modelFamilies.map(({ icon, label }) => <div key={icon}><ModelIcon name={icon} label={label} /><span>{label}</span></div>)}</div></div></section>
    <section className="priceai-boundary-section"><div className="priceai-container"><div className="priceai-section-heading"><p className="priceai-kicker">核验边界</p><h2>PriceAI 提供信息，不替任何渠道背书。</h2><p>我们保留能被回看的事实，最终交易仍然发生在原平台。</p></div><div className="priceai-boundary-grid">{[["来源能不能回看？","保留原始渠道名、商品标题和购买链接，方便你回到原平台核验。"],["库存和时间是否可核验？","重点看有货/缺货状态和最近更新时间，长期未更新的低价不应直接当成可买价。"],["交付和售后谁负责？","PriceAI 不参与交易。付款、交付、售后、退款和账号风险都按原平台规则判断。"]].map(([title,text])=><article key={title}><span className="priceai-icon"><LineIcon name="clipboard" /></span><h3>{title}</h3><p>{text}</p></article>)}</div><div className="priceai-return-card"><span className="priceai-icon"><LineIcon name="question" /></span><div><h3>购买前回到原平台确认</h3><p>付款、交付、售后、退款和账号风险都要按原平台规则判断。</p></div><a className="priceai-btn" href="#faq">看常见问题</a></div></div></section>
    <section className="priceai-faq-section" id="faq"><div className="priceai-container"><div className="priceai-section-heading"><p className="priceai-kicker">常见问题</p><h2>买之前，先看这几条。</h2><p>首页只保留购买前最容易踩坑的问题。更细的背景说明放到指南里继续维护。</p></div><div className="priceai-faq-list">{faqs.map(([q,a])=><article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div></div></section>
  </main><SiteFooter /></div>;
}
