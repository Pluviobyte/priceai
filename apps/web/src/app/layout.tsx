import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./styles.css";

const deploymentOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? (deploymentOrigin ? `https://${deploymentOrigin}` : "http://localhost:3000")),
  title: "PriceAI | AI 订阅充值与 API 中转权威比价平台",
  description: "AI 会员充值、成品号、兑换码与模型接口中转的价格对照：官方价附厂商页面证据，渠道报价标注交付方式、库存与最后确认时间。不销售、不代收款、不替渠道背书。",
  openGraph: {
    title: "PriceAI | AI 订阅充值与 API 中转权威比价平台",
    description: "官方价对照渠道最低价，并标出这个低价是用哪种交付方式换来的。每条报价可回溯到原站。",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const colorTheme = process.env.PRICEAI_COLOR_THEME === "green" ? "green" : "blue";
  // 首屏前恢复深浅色与配色版本，避免页面先以默认外观闪一下。
  const appearanceInit = `(function(){try{var root=document.documentElement;var theme=localStorage.getItem("priceai-theme");if(theme==="dark"||theme==="light")root.dataset.theme=theme;var edition=localStorage.getItem("priceai-color-theme");if(edition==="blue"||edition==="green")root.dataset.brandTheme=edition}catch(_){}})()`;

  return (
    <html lang="zh-CN" data-brand-theme={colorTheme} suppressHydrationWarning>
      <head>
        <Script id="site-appearance-init" strategy="beforeInteractive">{appearanceInit}</Script>
      </head>
      <body>
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
