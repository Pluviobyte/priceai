import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SPONSORS_ENABLED } from "@/lib/site-features";
import { sponsors } from "@/lib/sponsors";
import { SiteFooter } from "../site-footer";
import styles from "./sponsors.module.css";

export const metadata: Metadata = {
  title: "赞助商与合作 | PriceAI",
  description: "了解 PriceAI 的赞助与推广展示、合作方式和投放规范。赞助不影响价格数据与自然排序。",
  alternates: { canonical: "/sponsors" },
};

const faqs = [
  ["如何成为 PriceAI 的赞助商？", "通过下方的合作入口联系，提供服务名称、公开落地页、简短介绍、素材与期望展示周期。双方确认内容、位置和合作安排后再上线。"],
  ["有哪些赞助位置可以选择？", "本页提供旗舰展示和品牌卡片，也可以咨询顶部公告、官方 API 或中转 API 频道的展示位置。具体可用位置与周期以沟通确认为准。"],
  ["赞助会影响比价结果或渠道排名吗？", "不会。赞助和推广会明确标识，与价格数据、库存、更新时间及自然排序分开。展示不代表 PriceAI 对服务质量或交易安全作出担保。"],
  ["需要准备哪些素材？", "请准备品牌标识、短标题、30 到 80 字的服务说明及可公开访问的官网或活动页。旗舰横幅建议使用 16:5 的图片，优惠信息需附适用条件与有效期。"],
] as const;

function Heart() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></svg>;
}

export default function SponsorsPage() {
  if (!SPONSORS_ENABLED) notFound();

  return (
    <div className="priceai-page">

      <main className={styles.page}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}><Heart /> 独立比价 · 一起支持</span>
          <h1>感谢每一份支持</h1>
          <p>让分散的 AI 价格更透明，让每一次选择更有依据。<br />感谢愿意与 PriceAI 一起，为用户提供有价值信息与服务的伙伴。</p>
          <Link className={styles.textLink} href="#join">成为赞助商 <span aria-hidden="true">↗</span></Link>
        </header>

        <section className={styles.section} aria-labelledby="flagship-heading">
          <div className={styles.sectionHeading}><h2 id="flagship-heading">旗舰赞助商</h2><p>一个更完整的展示空间，留给值得被了解的服务。</p></div>
          <div className={styles.featured}>
            <div className={styles.featuredBanner}>
              <div className={styles.featuredCopy}>
                <span className={styles.bannerLabel}>PriceAI · 合作展示</span>
                <h3>让你的服务，<br />与下一位用户相遇。</h3>
                <p>连接 AI 使用者与开发者</p>
              </div>
              <div className={styles.orbit} aria-hidden="true"><span /><span /><span /><b>P<span className={styles.orbitDot}>.</span></b></div>
            </div>
            <div className={styles.featuredFooter}>
              <div><div className={styles.featuredTitle}><h3>旗舰合作位</h3><span className={styles.tag}>开放合作</span></div><p>品牌介绍、服务特色与活动入口，在这里集中呈现。</p></div>
              <Link className={styles.button} href="/commercial#slots">了解合作方式 <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="partners-heading">
          <div className={styles.sectionHeading}><h2 id="partners-heading">赞助与推广</h2><p>从云基础设施到 AI 工具，发现更多服务。</p></div>
          <div className={styles.grid}>
            {sponsors.map((sponsor) => (
              <article className={styles.card} key={sponsor.id}>
                <div className={styles.cardHeading}>
                  <span className={styles.mark} aria-hidden="true">{sponsor.mark}</span>
                  <div><h3>{sponsor.name}</h3><p>{sponsor.category}</p></div>
                  <span className={styles.disclosure}>{sponsor.disclosure}</span>
                </div>
                <p className={styles.cardSummary}>{sponsor.summary}</p>
                {sponsor.href ? <a className={styles.cardLink} href={sponsor.href} target="_blank" rel="sponsored noopener noreferrer">访问网站 <span aria-hidden="true">↗</span></a> : <span className={styles.cardPending}>服务入口待补充</span>}
              </article>
            ))}
            <Link className={styles.joinCard} href="#join"><span aria-hidden="true">＋</span><h3>下一个，可以是你</h3><p>向正在寻找方案的用户介绍你的服务</p><b>加入合作 <span aria-hidden="true">↗</span></b></Link>
          </div>
          <p className={styles.disclaimer}>赞助与推广独立展示，不参与价格排序，也不代表平台背书。以上沿用原首页展示条目，服务入口及活动信息将在确认后补充。</p>
        </section>

        <section className={styles.section} aria-labelledby="offers-heading">
          <div className={styles.sectionHeading}><h2 id="offers-heading">合作信息一览</h2><p>服务方向、推广标识与活动状态，放在一处看清楚。</p></div>
          <div className={styles.tableWrap} role="region" aria-labelledby="offers-heading" tabIndex={0}>
            <table className={styles.table}><thead><tr><th scope="col">服务</th><th scope="col">服务方向</th><th scope="col">展示类型</th><th scope="col">活动 / 专属福利</th></tr></thead><tbody>
              {sponsors.map((sponsor) => <tr key={sponsor.id}><th scope="row"><span className={styles.tableBrand}><span className={styles.smallMark} aria-hidden="true">{sponsor.mark}</span>{sponsor.name}</span></th><td>{sponsor.category}</td><td><span className={styles.tag}>{sponsor.disclosure}</span></td><td className={styles.pending}>暂无已确认活动</td></tr>)}
            </tbody></table>
          </div>
          <p className={styles.tableNote}>优惠条件与有效期以服务方的原始页面为准；未确认的价格和优惠码不作展示。</p>
        </section>

        <section className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-heading">
          <div className={styles.sectionHeading}><h2 id="faq-heading">常见问题</h2><p>关于赞助，你可能想先了解这些。</p></div>
          {faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true" className={styles.chevron}>⌄</span></summary><p>{answer}</p></details>)}
        </section>

        <section className={styles.join} id="join" aria-labelledby="join-heading">
          <span className={styles.eyebrow}><Heart /> 与 PriceAI 一起</span>
          <h2 id="join-heading">让合适的用户，发现你的服务</h2>
          <p>如果你正在做 AI 服务、开发者工具或基础设施，<br />欢迎带着产品与资料来聊聊，找到适合你的展示方式。</p>
          <ul className={styles.benefits}><li>品牌展示</li><li>活动入口</li><li>资料直达</li><li>长期合作</li></ul>
          <Link className={styles.button} href="/commercial">了解赞助合作 <span aria-hidden="true">↗</span></Link>
          <span className={styles.contact}>Telegram 联系方式准备中</span>
          <p className={styles.joinNote}>赞助支持平台持续维护，但不会改变比价的独立性。</p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
