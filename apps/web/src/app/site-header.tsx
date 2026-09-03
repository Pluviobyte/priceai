import Link from "next/link";

type HeaderSection = "home" | "subscriptions" | "official" | "api" | "transit" | "channels" | "changes" | "submit" | "methodology" | "status";

export function SiteHeader({ active = "home" }: { active?: HeaderSection }) {
  return (
    <header className="topbar">
      <Link className="brand" href="/" aria-label="AI 价格雷达首页">
        <span className="brand-mark">A</span><span>AI 价格雷达</span>
      </Link>
      <nav aria-label="主导航">
        <Link className={active === "home" ? "active" : undefined} href="/">首页</Link>
        <Link className={active === "subscriptions" ? "active" : undefined} href="/subscriptions">卡网订阅</Link>
        <Link className={active === "official" ? "active" : undefined} href="/official-prices">官方订阅</Link>
        <Link className={active === "api" ? "active" : undefined} href="/official-api">官方 API</Link>
        <Link className={active === "transit" ? "active" : undefined} href="/api-transit">中转 API</Link>
        <Link className={active === "changes" ? "active" : undefined} href="/changes">价格异动</Link>
        <Link className={active === "methodology" ? "active" : undefined} href="/methodology">数据说明</Link>
      </nav>
      <div className="header-actions">
        <Link className="directory-link" href="/channels">来源目录</Link>
        <Link className={`submit-link${active === "submit" ? " active" : ""}`} href="/submit">提交渠道</Link>
      </div>
    </header>
  );
}
