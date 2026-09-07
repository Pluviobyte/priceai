import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PersistentSiteHeader } from "./persistent-site-header";
import "./styles.css";
import "./form-controls.css";

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
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <a className="skip-link" href="#main-content">跳到主要内容</a>
        <PersistentSiteHeader />
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
