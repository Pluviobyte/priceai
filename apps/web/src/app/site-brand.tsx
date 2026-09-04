import Link from "next/link";
import { IceCubeLogo } from "./cube-logo";
import { ResendCubeLogo } from "./resend-cube-logo";

/**
 * 站点自己的名称与标识。名称来自 PRODUCT.md 的产品定义，
 * 不沿用任何对标站点的名称、字标或图形。
 */
export const SITE_NAME = "AI 价格雷达";
export const SITE_TAGLINE = "价格情报与渠道核验";
// Temporary rollout: set NEXT_PUBLIC_HEADER_LOGO_VARIANT=classic for an immediate rollback.
const HEADER_LOGO_VARIANT = process.env.NEXT_PUBLIC_HEADER_LOGO_VARIANT === "classic" ? "classic" : "ice";

/**
 * 品牌标记：一个雷达象限。原点在左下角，两道扫描弧线向右上展开，
 * 弧线之间的实心圆点代表被捕捉到的一条报价。
 * 颜色全部走主题变量，蓝色浅色版和深色模式下都成立。
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="site-brand-mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--site-mark-bg)" />
      <path d="M8 8a17 17 0 0 1 17 17" fill="none" stroke="var(--site-mark-ink)" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <path d="M8 15.5a9.5 9.5 0 0 1 9.5 9.5" fill="none" stroke="var(--site-mark-ink)" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
      <circle cx="8" cy="25" r="2.2" fill="var(--site-mark-ink)" opacity=".55" />
      <circle cx="17.6" cy="15.4" r="2.9" fill="var(--site-mark-ink)" />
    </svg>
  );
}

export function BrandLockup({ tagline = true }: { tagline?: boolean }) {
  return (
    <Link className="site-brand" href="/" aria-label={`${SITE_NAME} 首页`}>
      {HEADER_LOGO_VARIANT === "ice" ? <IceCubeLogo size={48} /> : <ResendCubeLogo />}
      <span className="site-brand-name">{SITE_NAME}</span>
      {tagline && <span className="site-brand-tagline">{SITE_TAGLINE}</span>}
    </Link>
  );
}
