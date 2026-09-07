import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { docsArticles, getDocArticle } from "@/lib/docs-content";
import { SiteFooter } from "../../site-footer";
import { DocCard } from "../doc-card";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" });

export function generateStaticParams() {
  return docsArticles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) return { title: "文档 | PriceAI" };
  return {
    title: `${article.title} | PriceAI`,
    description: article.excerpt,
    alternates: { canonical: `/docs/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: [{ url: article.imageUrl, alt: article.imageAlt }],
    },
  };
}

export default async function DocArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getDocArticle(slug);
  if (!article) notFound();

  const deploymentOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const base = process.env.PUBLIC_BASE_URL ?? (deploymentOrigin ? `https://${deploymentOrigin}` : "http://localhost:3000");
  const related = docsArticles.filter((item) => item.slug !== article.slug).slice(0, 3);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    image: [article.imageUrl],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Organization", name: "PriceAI" },
    publisher: { "@type": "Organization", name: "PriceAI", url: base },
    mainEntityOfPage: `${base}/docs/${article.slug}`,
  };

  return (
    <div className="priceai-page priceai-article-page">

      <main>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replaceAll("<", "\\u003c") }} />
        <section className="priceai-article-hero">
          <nav aria-label="面包屑"><Link href="/">首页</Link><span>/</span><Link href="/docs">文档</Link><span>/</span><b>{article.category}</b></nav>
          <div className="priceai-article-heading">
            <h1>{article.title}</h1>
            <p>{article.excerpt}</p>
          </div>
          <div className="priceai-article-meta"><span>{article.category}</span><time dateTime={article.publishedAt}>发布于 {dateFormatter.format(new Date(`${article.publishedAt}T00:00:00+08:00`))}</time><span>约 {article.readingMinutes} 分钟阅读</span></div>
        </section>

        <figure className="priceai-article-cover">
          <img src={article.imageUrl} alt={article.imageAlt} fetchPriority="high" />
          <figcaption>临时封面视觉来源：<a href="https://www.anthropic.com/" target="_blank" rel="noopener noreferrer">Anthropic 官网</a>。文章内容由 PriceAI 独立整理。</figcaption>
        </figure>

        <div className="priceai-article-layout">
          <article className="priceai-article-body">
            <p className="priceai-article-lead">购买 AI 服务时，价格通常是最先看到的数字，却不是唯一需要比较的条件。下面按可执行的顺序拆开判断。</p>
            {article.sections.map((section) => (
              <section id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
              </section>
            ))}
            <aside className="priceai-article-disclaimer"><b>购买前提醒</b><p>本文提供比较方法，不构成销售承诺或渠道背书。产品规则与报价可能变化，请以厂商和商家原始页面为准。</p></aside>
          </article>

          <aside className="priceai-article-toc" aria-label="文章目录">
            <span>本文目录</span>
            {article.sections.map((section, index) => <a href={`#${section.id}`} key={section.id}><i>{String(index + 1).padStart(2, "0")}</i>{section.title}</a>)}
            <Link href="/docs">返回全部文档 <b aria-hidden="true">→</b></Link>
          </aside>
        </div>

        <section className="priceai-related-docs" aria-labelledby="related-docs">
          <header><span>继续阅读</span><h2 id="related-docs">相关文档</h2></header>
          <div className="priceai-doc-grid">{related.map((item) => <DocCard article={item} key={item.slug} />)}</div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
