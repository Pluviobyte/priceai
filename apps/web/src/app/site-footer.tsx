import Link from "next/link";
import { SPONSORS_ENABLED } from "@/lib/site-features";

export function SiteFooter() {
  return (
    <footer className="priceai-footer">
      <nav className="priceai-footer-actions" aria-label="返回首页核心内容">
        <Link className="priceai-footer-button primary" href="/#channels">↑　先选购买路径</Link>
        <Link className="priceai-footer-button" href="/#baseline">↑　直接看全网底价</Link>
      </nav>
      <div className="priceai-footer-meta">
        <span>PriceAI · 中立比价，不参与交易</span>
        {SPONSORS_ENABLED && <Link href="/sponsors">赞助商与合作</Link>}
      </div>
    </footer>
  );
}
