/** Keep navigation separate from the collector's original evidence URL. */
export function officialPriceHref(row: { vendor: string; planCode: string; id?: string }): string {
  const vendor = row.vendor.toLowerCase();
  const plan = row.planCode.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `/official-prices/${encodeURIComponent(`${vendor}__${plan}`)}${row.id ? `#quote-${encodeURIComponent(row.id)}` : ""}`;
}

export function isPricingInterface(url: string): boolean {
  try {
    return /^\/(?:backend-anon|backend-api|api)(?:\/|$)/.test(new URL(url).pathname);
  } catch { return false; }
}

export function officialPageUrl(url: string): string {
  if (isPricingInterface(url) && new URL(url).hostname === "chatgpt.com") return "https://chatgpt.com/pricing/";
  return url;
}
