import Link from "next/link";

/**
 * 付费展示位。label 是广告披露标签，必须跟着每一条一起显示。
 * href 缺省时指向赞助说明页；imageUrl 缺省时用名称首字生成字母标记，
 * 不再为没有图的赞助商保留一块空白图片区。
 */
type Sponsor = {
  name: string;
  summary: string;
  label: string;
  href?: string;
  imageUrl?: string;
};

const sponsors: readonly Sponsor[] = [
  { name: "阿里云海外轻量服务器", label: "推广", summary: "适合自用 CPA 反代、开发测试和 AI 工具备用机；2 核 2G 配置新人低至 68 元/年起，首购享 85 折优惠。" },
  { name: "腾讯云境外轻量服务器", label: "推广", summary: "适合小团队搭建 sub2api 自用中转、openclaw 等；2 核 4G 配置活动低至 199 元/年起，新老同享。" },
  { name: "PackyAPI：致力于高可用的中转", label: "赞助", summary: "提供可靠高效的 API 中转服务，一句话接入主流大模型，统一域名、统一密钥、智能容灾切换。" },
  { name: "OpenCode Go：国产模型编程订阅", label: "推广", summary: "支持 GLM、Kimi、Qwen、MiniMax、DeepSeek 等主流国产开放模型，提供月度上限约 $60 用量。" },
  { name: "Spaceship 低价数字 .xyz 域名", label: "推广", summary: "6 至 9 位纯数字 .xyz 域名低至 ¥4.55/年，适合个人项目、API 入口和 Agent 服务快速配域名。" },
  { name: "合聚 API：低价接入全球主流模型", label: "赞助", summary: "支持 OpenAI、Anthropic、Google、字节跳动 SeeDance 视频生成模型，统一接口接入，稳定、高速、低成本。" },
  { name: "VMCard｜企业级虚拟卡平台", label: "赞助推广", summary: "覆盖 GPT / Claude 订阅、云服务、广告投放等主流海外支付场景，支持 API 自动开卡与批量开卡。" },
];

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const href = sponsor.href ?? "/commercial";
  const external = /^https?:/i.test(href);
  return (
    <a
      className="site-sponsor"
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "sponsored noopener noreferrer" : "sponsored"}
    >
      <span className="site-sponsor-mark" aria-hidden="true">
        {sponsor.imageUrl ? <img src={sponsor.imageUrl} alt="" loading="lazy" /> : sponsor.name.trim().charAt(0)}
      </span>
      <span className="site-sponsor-body">
        <span className="site-sponsor-title">
          <b>{sponsor.name}</b>
          <em><span className="sr-only">广告标识：</span>{sponsor.label}</em>
        </span>
        <span className="site-sponsor-summary">{sponsor.summary}</span>
      </span>
    </a>
  );
}

export function SiteFooter({ showSponsors = false }: { showSponsors?: boolean }) {
  return (
    <footer className="priceai-footer">
      <nav className="priceai-footer-actions" aria-label="返回首页核心内容">
        <Link className="priceai-footer-button primary" href="/#channels">↑　先选购买路径</Link>
        <Link className="priceai-footer-button" href="/#baseline">↑　直接看全网底价</Link>
      </nav>
      {showSponsors && (
        <section className="site-sponsors" aria-labelledby="site-sponsors-heading">
          <div className="priceai-container">
            <div className="site-sponsors-head">
              <div>
                <h2 id="site-sponsors-heading">赞助与推广</h2>
                <p>以下为付费展示位，排列顺序与价格数据无关。平台不代收款、不做担保，下单前请自行核验对方的服务条款与售后。</p>
              </div>
              <Link className="site-sponsors-cta" href="/commercial#slots">成为赞助商</Link>
            </div>
            <div className="site-sponsor-grid">
              {sponsors.map((sponsor) => <SponsorCard sponsor={sponsor} key={sponsor.name} />)}
            </div>
          </div>
        </section>
      )}
    </footer>
  );
}
