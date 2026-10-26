import type { Metadata } from "next";
import Link from "next/link";
import { INQUIRY_KINDS, inquiryKind } from "@/lib/site-inquiries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "意见反馈与合作联系 | PriceAI",
  description: "提交平台建议、数据问题，或联系 PriceAI 洽谈赞助、批发与其他合作。",
};

const errorMessages: Record<string, string> = {
  invalid: "请填写联系方式和至少 5 个字的说明。",
  rate: "提交过于频繁，请一小时后再试。",
};

const intros: Record<keyof typeof INQUIRY_KINDS, string> = {
  feedback: "功能建议、页面问题、数据口径疑问都可以写在这里。单条报价的价格或库存错误，请在对应商品页点击举报，处理更快。",
  sponsor: "说明你的服务、希望出现的位置和展示周期。赞助位会明确标注，不改变价格排序和最低价计算。",
  wholesale: "说明商品、交付方式、数量区间和售后范围。PriceAI 只做信息对接，不参与交易和收款。",
  cooperation: "数据合作、内容合作或其他事项，请说明来意和你希望的合作方式。",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ kind?: string; error?: string; sent?: string }> }) {
  const params = await searchParams;
  const kind = inquiryKind(params.kind);
  return (
    <main>
      <section className="form-shell">
        <div className="form-intro">
          <span className="section-kicker">联系 PriceAI</span>
          <h1>{INQUIRY_KINDS[kind]}</h1>
          <p>{intros[kind]}</p>
        </div>
        <nav className="submission-paths" aria-label="联系类型">
          {(Object.keys(INQUIRY_KINDS) as Array<keyof typeof INQUIRY_KINDS>).map((key) => key === kind
            ? <span className="active" key={key}><b>{INQUIRY_KINDS[key]}</b></span>
            : <Link key={key} href={`/contact?kind=${key}`}><b>{INQUIRY_KINDS[key]}</b></Link>)}
          <Link href="/submit"><b>收录店铺</b><small>提交公开店铺进入预检</small></Link>
        </nav>
        {params.sent ? <div className="form-success">已收到，我们会通过你留下的联系方式回复。</div> : null}
        {params.error ? <div className="form-error">{errorMessages[params.error] ?? errorMessages.invalid}</div> : null}
        <form className="public-form" action="/api/inquiries" method="post">
          <input type="hidden" name="kind" value={kind} />
          <label>称呼<input name="name" maxLength={120} placeholder="选填" /></label>
          <label>联系方式<input name="contact" maxLength={200} minLength={3} placeholder="邮箱、Telegram 或微信，仅用于回复，不公开展示" required /></label>
          <label>说明<textarea name="message" maxLength={3000} minLength={5} placeholder="请尽量写清楚背景和你希望的处理方式" required /></label>
          <label className="honeypot" aria-hidden="true">网站<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <button type="submit">提交</button>
        </form>
        <p className="privacy-note">我们只保存回复所需的信息，不会公开你的联系方式。</p>
      </section>
    </main>
  );
}
