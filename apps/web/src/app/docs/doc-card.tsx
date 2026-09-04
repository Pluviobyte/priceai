import Link from "next/link";
import type { DocArticle } from "@/lib/docs-content";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" });

export function DocCard({ article, priority = false }: { article: DocArticle; priority?: boolean }) {
  return (
    <article className="priceai-doc-card">
      <Link className="priceai-doc-card-image" href={`/docs/${article.slug}`} tabIndex={-1} aria-hidden="true">
        <img src={article.imageUrl} alt="" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
      </Link>
      <div className="priceai-doc-card-meta">
        <span>{article.category}</span>
        <time dateTime={article.publishedAt}>{dateFormatter.format(new Date(`${article.publishedAt}T00:00:00+08:00`))}</time>
        <span>{article.readingMinutes} 分钟阅读</span>
      </div>
      <h2><Link href={`/docs/${article.slug}`}>{article.title}</Link></h2>
      <p>{article.excerpt}</p>
      <Link className="priceai-doc-card-link" href={`/docs/${article.slug}`}>阅读全文 <span aria-hidden="true">→</span></Link>
    </article>
  );
}
