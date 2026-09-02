export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid: "请检查网址和填写内容。仅接受公开的 HTTP/HTTPS 店铺地址。",
  rate: "提交过于频繁，请一小时后再试。",
};

export default async function SubmitPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/"><span className="brand-mark">A</span><span>AI 价格雷达</span></a>
        <nav aria-label="主导航"><a href="/">卡网订阅</a><a className="active" href="/submit">提交渠道</a></nav>
        <a className="submit-link" href="/channels">来源目录</a>
      </header>
      <section className="form-shell">
        <div className="form-intro">
          <span className="section-kicker">渠道收录</span>
          <h1>提交公开店铺</h1>
          <p>提交后会先做 URL 安全检查、系统识别和小规模试采集，再由运营人员确认。候选店铺不会自动进入公开比价。</p>
        </div>
        {error ? <div className="form-error">{errorMessages[error] ?? errorMessages.invalid}</div> : null}
        <form className="public-form" action="/api/submissions" method="post">
          <label>店铺网址<input type="url" name="url" maxLength={2048} placeholder="https://example.com/shop" required /></label>
          <label>店铺名称<input name="name" maxLength={120} placeholder="选填" /></label>
          <label>主营商品<textarea name="primaryProducts" maxLength={500} placeholder="例如 ChatGPT Plus、Claude Pro" /></label>
          <label>联系方式<input name="contact" maxLength={200} placeholder="选填，仅用于核对，不公开展示" /></label>
          <label>备注<textarea name="notes" maxLength={2000} placeholder="Feed 地址、商品特点或需要说明的情况" /></label>
          <label className="honeypot" aria-hidden="true">网站<input name="website" tabIndex={-1} autoComplete="off" /></label>
          <button type="submit">提交并开始预检</button>
        </form>
        <p className="privacy-note">我们只保存处理投稿所需的信息；提交网址不会绕过登录、验证码或站点防护。</p>
        <p className="privacy-note">已有稳定 JSON API？<a href="/merchant-feed"> 申请商家直连 Feed →</a></p>
      </section>
    </main>
  );
}
