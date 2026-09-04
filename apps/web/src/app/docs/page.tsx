import type { Metadata } from "next";
import Link from "next/link";
import { docsArticles } from "@/lib/docs-content";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";
import { DocCard } from "./doc-card";

export const metadata: Metadata = {
  title: "AI 订阅、API 与渠道比价文档 | PriceAI",
  description: "PriceAI 内容中心，提供 AI 订阅购买、官方价格、第三方渠道、API 中转、模型检测和交易风险的实用文档。",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  const featured = docsArticles.slice(0, 3);
  const latest = docsArticles.slice(3);

  return (
    <div className="priceai-page priceai-library">
      <SiteHeader active="docs" />
      <main>
        <section className="priceai-library-hero">
          <div><span>PriceAI Knowledge</span><h1>文档与观察</h1></div>
          <p>从购买方式、真实成本到 API 检测与渠道风险，把散落的信息整理成可以直接执行的判断方法。</p>
        </section>

        <section className="priceai-library-section" aria-labelledby="featured-docs">
          <header><div><span>从这里开始</span><h2 id="featured-docs">精选文档</h2></div><p>先建立共同的比较口径，再进入具体产品与渠道。</p></header>
          <div className="priceai-doc-grid">
            {featured.map((article, index) => <DocCard article={article} priority={index < 2} key={article.slug} />)}
          </div>
        </section>

        <section className="priceai-library-section priceai-library-latest" aria-labelledby="latest-docs">
          <header><div><span>持续补充</span><h2 id="latest-docs">最新指南</h2></div><Link href="/guides">查看快速入门 <b aria-hidden="true">→</b></Link></header>
          <div className="priceai-doc-grid">
            {latest.map((article) => <DocCard article={article} key={article.slug} />)}
          </div>
        </section>

        <aside className="priceai-library-note">
          <span>内容原则</span>
          <p>文档解释方法，不替任何渠道背书。价格、库存与产品规则可能变化，购买前请回到原始来源再次核验。</p>
          <Link href="/methodology">查看数据说明 <b aria-hidden="true">→</b></Link>
        </aside>
      </main>
      <SiteFooter />
    </div>
  );
}
