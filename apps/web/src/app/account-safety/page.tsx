import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "防封指南 | PriceAI",
  description: "防封指南，待上线。",
  robots: { index: false, follow: true },
};

export default function AccountSafetyPage() {
  return (
    <div className="priceai-page">

      <main className="priceai-simple-page">
        <section>
          <span>防封指南</span>
          <h1>待上线</h1>
          <p>内容正在准备中，敬请期待。</p>
          <div className="priceai-simple-actions">
            <Link href="/">返回首页</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
