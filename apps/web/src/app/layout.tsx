import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./styles.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000"),
  title: "AI 价格雷达",
  description: "比较 AI 订阅、账号、充值与 API 服务的价格、库存和来源证据。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body><a className="skip-link" href="#main-content">跳到主要内容</a><div id="main-content">{children}</div></body>
    </html>
  );
}
