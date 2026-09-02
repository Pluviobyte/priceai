export function SiteHeader({ active = "card" }: { active?: "card" | "official" | "api" | "transit" | "channels" | "submit" | "methodology" | "status" }) {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="AI 价格雷达首页">
        <span className="brand-mark">A</span><span>AI 价格雷达</span>
      </a>
      <nav aria-label="主导航">
        <a className={active === "card" ? "active" : undefined} href="/">AI 订阅</a>
        <a className={active === "official" ? "active" : undefined} href="/official-prices">官方订阅</a>
        <a className={active === "api" ? "active" : undefined} href="/official-api">官方 API</a>
        <a className={active === "transit" ? "active" : undefined} href="/api-transit">API 中转</a>
        <a className={active === "channels" ? "active" : undefined} href="/channels">来源目录</a>
        <a className={active === "methodology" ? "active" : undefined} href="/methodology">数据说明</a>
        <a className={active === "status" ? "active" : undefined} href="/status">系统健康</a>
      </nav>
      <a className="submit-link" href="/submit">提交渠道</a>
    </header>
  );
}
