/** Resolve icons from the merchant's source, never from its display name. */
export function merchantIconUrl(source: string | null): string | null {
  try {
    const url = new URL(source ?? "");
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    // Only public domain names; do not ask a visitor's browser to load local hosts.
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)
      || /\.(localhost|local|internal|test|invalid)$/.test(host)) return null;
    if (["wzyp.cn", "www.wzyp.cn", "pay.ldxp.cn", "www.ldxp.cn", "ldxp.cn"].includes(host)) {
      return "/merchant-icons/wzyp.ico";
    }
    if (["16688.com.cn", "www.16688.com.cn"].includes(host)) return "/merchant-icons/16688.png";
    return new URL("/favicon.ico", url.origin).href;
  } catch { return null; }
}
