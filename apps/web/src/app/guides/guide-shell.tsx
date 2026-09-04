"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { SITE_NAME } from "../site-brand";
import { SiteHeader } from "../site-header";

type GuideIconName = "start" | "subscription" | "official" | "channel" | "api";

function GuideNavIcon({ name }: { name: GuideIconName }) {
  const paths = {
    start: <><path d="M5 12h14m-6-6 6 6-6 6" /><path d="M5 6v12" /></>,
    subscription: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M7 9h10M7 13h6" /></>,
    official: <><path d="M12 3 4 7v5c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V7z" /><path d="m9 12 2 2 4-4" /></>,
    channel: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2" /><path d="M3 20v-2a5 5 0 0 1 10 0v2M14 16a4 4 0 0 1 7 2.7V20" /></>,
    api: <><path d="M8 9 4 12l4 3M16 9l4 3-4 3M14 5l-4 14" /></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const navGroups = [
  {
    icon: "start",
    title: "快速入门",
    links: [
      { label: "快速入门", href: "/guides#about", slug: "getting-started" },
      { label: "使用 PriceAI", href: "/guides#use-priceai", slug: "getting-started-use" },
      { label: "使用场景", href: "/guides#problems", slug: "getting-started-problems" },
      { label: "核心功能", href: "/guides#features", slug: "getting-started-features" },
      { label: "购买前核验", href: "/guides#verify", slug: "getting-started-verify" },
      { label: "覆盖范围", href: "/guides#coverage", slug: "getting-started-coverage" },
      { label: "数据原则", href: "/guides#principles", slug: "getting-started-principles" },
    ],
  },
  {
    icon: "subscription",
    title: "订阅与价格",
    links: [
      { label: "AI 订阅价格为什么差很多", href: "/guides/why-ai-subscription-prices-differ", slug: "why-ai-subscription-prices-differ" },
      { label: "官方地区价风险", href: "/guides/ai-subscription-region-price-risks", slug: "ai-subscription-region-price-risks" },
      { label: "ChatGPT 获取方式", href: "/guides/chatgpt-subscription-options", slug: "chatgpt-subscription-options" },
    ],
  },
  {
    icon: "official",
    title: "官方订阅",
    links: [
      { label: "如何自己完成官方订阅", href: "/guides/how-to-subscribe-ai-officially", slug: "how-to-subscribe-ai-officially" },
      { label: "Apple ID 订阅 AI", href: "/guides/apple-id-ai-subscription", slug: "apple-id-ai-subscription" },
      { label: "Google Play 订阅 AI", href: "/guides/google-play-ai-subscription", slug: "google-play-ai-subscription" },
    ],
  },
  {
    icon: "channel",
    title: "支付与渠道",
    links: [
      { label: "订阅 AI 需要什么支付卡", href: "/guides/visa-card-for-ai-subscription", slug: "visa-card-for-ai-subscription" },
      { label: "AI 订阅礼品卡限制", href: "/guides/ai-subscription-gift-card", slug: "ai-subscription-gift-card" },
      { label: "卡网渠道靠谱吗", href: "/guides/are-ai-subscription-card-shops-reliable", slug: "are-ai-subscription-card-shops-reliable" },
    ],
  },
  {
    icon: "api",
    title: "API 与中转",
    links: [
      { label: "API 中转站怎么比较", href: "/guides/api-transit", slug: "api-transit" },
      { label: "搭建自用 API 中转站", href: "/guides/self-host-api-transit", slug: "self-host-api-transit" },
    ],
  },
] as const;

type TocItem = { id: string; label: string; level?: 2 | 3 };

export function GuideShell({ children, toc = [], currentSlug = "getting-started" }: { children: ReactNode; toc?: TocItem[]; currentSlug?: string }) {
  return <div className="priceai-docs">
    <SiteHeader active="guides" />

    <div className="priceai-doc-shell">
      <aside className="priceai-doc-sidebar">
        <form className="priceai-doc-search" action="/search"><span aria-hidden="true">⌕</span><input name="q" aria-label="搜索文档" placeholder="搜索文档..." /><kbd>⌘K</kbd></form>
        <nav aria-label="指南目录">
          {navGroups.map((group) => {
            const groupActive = group.links.some((item) => item.slug === currentSlug || (currentSlug.startsWith("getting-started") && item.slug.startsWith("getting-started")));
            return <details key={group.title} open className={groupActive ? "active" : undefined}>
              <summary><span><GuideNavIcon name={group.icon} /></span><b>{group.title}</b><i aria-hidden="true">⌄</i></summary>
              <div>{group.links.map((item, index) => {
                const active = item.slug === currentSlug || (currentSlug === "getting-started" && group.title === "快速入门" && index === 0);
                return <Link className={active ? "active" : undefined} aria-current={active ? "page" : undefined} href={item.href} key={item.href}>{item.label}</Link>;
              })}</div>
            </details>;
          })}
        </nav>
      </aside>

      <div className="priceai-doc-canvas">
        <article className="priceai-doc-article">{children}</article>
        <aside className="priceai-doc-toc" aria-label="本页内容"><h3>本页内容</h3>{toc.map((item) => <a className={item.level === 3 ? "nested" : undefined} href={`#${item.id}`} key={item.id}>{item.label}</a>)}</aside>
      </div>
    </div>

    <footer className="priceai-doc-footer"><div><strong><i aria-hidden="true" /> {SITE_NAME}</strong><p>把分散的 AI 订阅与 API 价格整理成可核验的购买清单。</p></div><nav aria-label="指南页脚导航"><Link href="/channels">卡网订阅</Link><Link href="/official-prices">官方订阅</Link><Link href="/official-api">官方 API</Link><Link href="/support">问题反馈</Link></nav></footer>
  </div>;
}
