import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GuideShell } from "../guide-shell";
import { guides } from "../guide-content";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = guides[slug];
  return guide ? { title: `${guide.title} | PriceAI`, description: guide.description } : { title: "指南 | PriceAI" };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = guides[slug];
  if (!guide) notFound();
  const toc = [...guide.sections.map(([id, title]) => ({ id, label: title })), { id: "related", label: "继续阅读" }];
  return <GuideShell toc={toc} currentSlug={slug}><h1>{guide.title}</h1><p className="lead">{guide.intro}</p>{guide.sections.map(([id, title, paragraphs, checklist], index) => <section key={id}><h2 id={id}>{title}</h2>{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{checklist?.length ? <ul>{checklist.map((item) => <li key={item}>{item}</li>)}</ul> : null}{index === 0 && <aside className="priceai-doc-callout info"><b>●　使用提示</b><p>PriceAI 只聚合公开信息。购买、付款或接入 API 前，请回到原始渠道核验最新规则。</p></aside>}</section>)}<h2 id="related">继续阅读</h2><div className="priceai-doc-inline-actions">{guide.related.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</div><p className="priceai-doc-back"><Link href="/guides">← 返回指南目录</Link>　<Link href="/">返回 PriceAI 主站</Link></p></GuideShell>;
}
