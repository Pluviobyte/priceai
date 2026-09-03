import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./styles.css";

const deploymentOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? (deploymentOrigin ? `https://${deploymentOrigin}` : "http://localhost:3000")),
  title: "PriceAI | AI 低价卡网订阅与中转 API 比价雷达",
  description: "购买 AI 订阅或接入 API 前，先理解官方订阅、卡网订阅、官方 API 和中转 API 的价格差异、来源、库存与风险边界。",
  openGraph: {
    title: "PriceAI | AI 低价卡网订阅与中转 API 比价雷达",
    description: "先看清 AI 订阅和 API 的购买路径，再进入卡网订阅、官方订阅、官方 API 或中转 API 比价。",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const colorTheme = process.env.PRICEAI_COLOR_THEME === "green" ? "green" : "blue";
  const colorThemeInit = `(function(){try{var value=localStorage.getItem("priceai-color-theme");if(value==="blue"||value==="green")document.documentElement.dataset.brandTheme=value}catch(_){}})()`;

  return (
    <html lang="zh-CN" data-brand-theme={colorTheme} suppressHydrationWarning>
      <body><Script id="priceai-color-theme-init" strategy="beforeInteractive">{colorThemeInit}</Script><a className="skip-link" href="#main-content">跳到主要内容</a><div id="main-content">{children}</div></body>
    </html>
  );
}
