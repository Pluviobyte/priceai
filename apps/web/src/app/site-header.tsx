"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ResendCubeLogo } from "./resend-cube-logo";

type HeaderSection = "home" | "subscriptions" | "official" | "api" | "transit" | "channels" | "changes" | "submit" | "methodology" | "status";

function Icon({ name, size = 16 }: { name: "moon" | "message" | "user" | "handshake" | "megaphone" | "close" | "arrow"; size?: number }) {
  const paths = {
    moon: <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />,
    message: <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />,
    user: <><path d="M2 21a8 8 0 0 1 13.292-6" /><circle cx="10" cy="8" r="5" /><path d="M19 16v6M22 19h-6" /></>,
    handshake: <><path d="m11 17 2 2a1 1 0 1 0 3-3M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.8 5.8 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4M21 3l1 11h-2M3 3 2 14l6.5 6.5a1 1 0 0 0 3-3" /></>,
    megaphone: <><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14M8 6v8" /></>,
    close: <path d="M18 6 6 18M6 6l12 12" />,
    arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function PriceAILogo() {
  return <span className="priceai-brand-logo" aria-hidden="true"><svg viewBox="0 0 64 64"><circle cx="28" cy="28" r="20" fill="var(--color-logo-lens-bg)" stroke="currentColor" strokeWidth="5" /><path d="M15 33 23 25 30 30 41 19" fill="none" stroke="var(--color-brand)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" /><circle cx="41" cy="19" r="3.6" fill="var(--color-brand)" /><path d="M43 43 56 56" stroke="currentColor" strokeLinecap="round" strokeWidth="7" /></svg></span>;
}

export function SiteHeader({ active = "home" }: { active?: HeaderSection }) {
  const pathname = usePathname();
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [dark, setDark] = useState(false);
  const [colorTheme, setColorTheme] = useState<"blue" | "green">("blue");

  useEffect(() => {
    const nextDark = window.localStorage.getItem("priceai-theme") === "dark";
    const savedColorTheme = window.localStorage.getItem("priceai-color-theme");
    const nextColorTheme = savedColorTheme === "green" || savedColorTheme === "blue"
      ? savedColorTheme
      : document.documentElement.dataset.brandTheme === "green" ? "green" : "blue";
    setDark(nextDark);
    setColorTheme(nextColorTheme);
    document.documentElement.dataset.theme = nextDark ? "dark" : "light";
    document.documentElement.dataset.brandTheme = nextColorTheme;
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.localStorage.setItem("priceai-theme", next ? "dark" : "light");
  }

  function selectColorTheme(next: "blue" | "green") {
    setColorTheme(next);
    document.documentElement.dataset.brandTheme = next;
    window.localStorage.setItem("priceai-color-theme", next);
  }

  return <>
    {noticeOpen && <div className="priceai-notice" role="region" aria-label="全站顶部通知条广告位"><Link href="/?qqGroup=1"><span><Icon name="megaphone" size={14} /> 公告</span><b>PriceAI QQ 交流群已开放</b><em>/</em><small>欢迎进群交流功能建议、产品想法、数据问题和使用反馈</small><Icon name="arrow" size={14} /></Link><button type="button" aria-label="关闭顶部广告" onClick={() => setNoticeOpen(false)}><Icon name="close" size={16} /></button></div>}
    <header className="priceai-header">
      <Link className="priceai-brand" href="/?home=1" aria-label="PriceAI 首页"><ResendCubeLogo /><span><strong>PriceAI</strong><small>AI 比价雷达</small></span></Link>
      <nav className="priceai-nav" aria-label="主导航"><Link className={active === "home" ? "active" : undefined} href="/?home=1">首页</Link><Link className={active === "subscriptions" || active === "channels" ? "active" : undefined} href="/channels">卡网订阅</Link><Link className={active === "official" ? "active" : undefined} href="/official-prices">官方订阅</Link><Link className={active === "api" ? "active" : undefined} href="/official-api">官方 API</Link><Link className={active === "transit" ? "active" : undefined} href="/api-transit">中转 API</Link><Link href="/guides">指南</Link></nav>
      <div className="priceai-header-actions"><div className="priceai-color-switch" role="group" aria-label="首页配色"><button className={colorTheme === "blue" ? "active" : undefined} type="button" aria-label="切换到蓝色版" aria-pressed={colorTheme === "blue"} onClick={() => selectColorTheme("blue")}><i className="blue" /><span>蓝色</span></button><button className={colorTheme === "green" ? "active" : undefined} type="button" aria-label="切换到绿色版" aria-pressed={colorTheme === "green"} onClick={() => selectColorTheme("green")}><i className="green" /><span>绿色</span></button></div><Link className="priceai-wholesale" href="/wholesale"><Icon name="handshake" />批发合作</Link><button className="priceai-dark-switch" type="button" onClick={toggleTheme} aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}><Icon name="moon" /></button><Link className="priceai-feedback" href="/support" aria-label="提交意见反馈"><Icon name="message" /></Link><a className="priceai-social qq" href="/?qqGroup=1" aria-label="查看 PriceAI QQ 交流群加入方式，群号 1106437080"><img src="https://priceai.cc/brand-icons/qq.svg?dpl=3b7255cafa5bfe60f6aecc223e1e7e716fda75f8" alt="" /></a><a className="priceai-social telegram" href="https://t.me/priceaicc" target="_blank" rel="noopener noreferrer" aria-label="加入 PriceAI Telegram 交流群"><img src="https://priceai.cc/brand-icons/telegram.svg?dpl=3b7255cafa5bfe60f6aecc223e1e7e716fda75f8" alt="" /></a><a className="priceai-social github" href="https://github.com/physics-dimension/PriceAI" target="_blank" rel="noopener noreferrer" aria-label="打开 PriceAI GitHub 仓库"><img src="https://priceai.cc/brand-icons/github.svg?dpl=3b7255cafa5bfe60f6aecc223e1e7e716fda75f8" alt="" /></a><Link className="priceai-login" href={`/login?next=${encodeURIComponent(pathname || "/")}`} aria-label="登录 PriceAI"><Icon name="user" /></Link></div>
    </header>
  </>;
}
