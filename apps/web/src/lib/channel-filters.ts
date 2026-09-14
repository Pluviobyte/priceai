export const CHANNEL_PAGE_SIZES = [20, 50, 100] as const;

export const CHANNEL_PLATFORMS = [
  ["", "全部模型"], ["OpenAI", "ChatGPT"], ["Anthropic", "Claude"],
  ["Google", "Gemini"], ["xAI", "Grok"], ["Anysphere", "Cursor"],
  ["Perplexity", "Perplexity"],
] as const;

/**
 * What a shopper is actually looking for. Brand alone cannot express it: a Gmail inbox
 * and Google AI Pro are both Google, and a 接码 service for OpenAI is not ChatGPT. The
 * category is derived from the product, and it cuts across the catalogue headings, so
 * choosing one looks past the subscriptions/accounts/resources split.
 */
export const CHANNEL_CATEGORIES = [
  ["", "全部品类"], ["chatgpt", "ChatGPT"], ["claude", "Claude"], ["gemini", "Gemini"],
  ["grok", "Grok"], ["mail", "邮箱"], ["verification", "接码"], ["other", "其他"],
] as const;

export const CHANNEL_MODES = {
  api_credit: "API 额度", recharge: "自己账号代充", finished_account: "成品账号", redeem_code: "兑换码 / 卡密",
  team_seat: "团队席位", shared_account: "共享账号", web_mirror: "网页镜像",
  reverse_proxy: "反代服务", short_term: "短期体验", unknown: "交付待确认",
} as const;

export const CHANNEL_WARRANTIES = {
  subscription_period: "订阅期质保", fixed_hours: "固定时长质保",
  first_login: "仅保首次登录", none: "无质保", unknown: "质保待确认",
} as const;

export const CHANNEL_OWNERSHIP = {
  buyer: "自己的账号", merchant: "商家账号", shared: "共享账号", unknown: "归属待确认",
} as const;

/**
 * The page has two entities: offers you compare, and the merchants selling them.
 * `group` is a zoom level on the offer table, not a third entity: `merged` shows
 * one row per comparable specification, `expanded` shows one row per raw offer.
 */
export type ChannelView = "compare" | "merchants";
export type ChannelGroup = "merged" | "expanded";

export type ChannelFilters = {
  q: string; platform: string; category: string; mode: string; duration: string; warranty: string;
  stock: string; currency: string; sort: string; view: ChannelView; group: ChannelGroup;
  catalog?: "subscriptions" | "resources" | "accounts"; page: number; pageSize: number; spec: string; product: string; layout: "cards" | "table";
};

/** A specification is what makes two offers comparable; it is the unit `merged` groups by. */
export interface ChannelSpec {
  product_slug: string; product_name: string; platform: string; offer_mode: string;
  duration_days: number | null; region: string | null; account_ownership: string;
  warranty_type: string; warranty_hours: number | null; currency: string;
}

export function channelMode(value: string): string {
  return CHANNEL_MODES[value as keyof typeof CHANNEL_MODES] ?? "交付待确认";
}

export function channelWarranty(value: string, hours?: number | null): string {
  const name = CHANNEL_WARRANTIES[value as keyof typeof CHANNEL_WARRANTIES] ?? "质保待确认";
  return hours ? `${name} ${hours} 小时` : name;
}

export function channelOwnership(value: string): string {
  return CHANNEL_OWNERSHIP[value as keyof typeof CHANNEL_OWNERSHIP] ?? value;
}

/** The parts a shopper must match for two prices to mean the same thing. */
export function channelSpecParts(spec: ChannelSpec): string[] {
  return [
    channelMode(spec.offer_mode),
    spec.duration_days ? `${spec.duration_days} 天` : "期限待确认",
    spec.region || "地区未标注",
    channelOwnership(spec.account_ownership),
    channelWarranty(spec.warranty_type, spec.warranty_hours),
    spec.currency,
  ];
}

/** Which shape the catalog query builds. Derived, never stored in the URL. */
export function catalogView(filters: ChannelFilters): "products" | "offers" | "merchants" {
  if (filters.view === "merchants") return "merchants";
  return filters.group === "expanded" ? "offers" : "products";
}

export function parseChannelFilters(raw: Record<string, string | string[] | undefined>): ChannelFilters {
  const first = (key: string) => (Array.isArray(raw[key]) ? raw[key][0] : raw[key])?.trim() ?? "";
  const choice = (key: string, choices: readonly string[], fallback = "") => choices.includes(first(key)) ? first(key) : fallback;
  const page = Number(first("page"));
  // `view=products|offers` are the pre-split URLs and still resolve to the same tables.
  const legacy = first("view");
  const view: ChannelView = (legacy === "merchants" || (!legacy && first("scope") === "merchants")) ? "merchants" : "compare";
  const group: ChannelGroup = first("group") === "merged" ? "merged"
    : first("group") === "expanded" || legacy === "offers" ? "expanded"
      : "merged";
  return {
    catalog: choice("catalog", ["subscriptions", "resources", "accounts"], "subscriptions") as "subscriptions" | "resources" | "accounts",
    q: first("q").slice(0, 160),
    spec: /^[a-f0-9]{32}$/.test(first("spec")) ? first("spec") : "",
    product: /^[a-z0-9][a-z0-9-]{1,59}$/.test(first("product")) ? first("product") : "",
    platform: choice("platform", CHANNEL_PLATFORMS.map(([value]) => value)),
    category: choice("category", CHANNEL_CATEGORIES.map(([value]) => value)),
    mode: choice("mode", Object.keys(CHANNEL_MODES)),
    duration: choice("duration", ["7", "30", "90", "180", "365"]),
    warranty: choice("warranty", Object.keys(CHANNEL_WARRANTIES)),
    stock: choice("stock", ["all", "available"], "all"),
    currency: choice("currency", ["CNY", "USD", "HKD", "EUR", "JPY"]),
    sort: choice("sort", view === "merchants" ? ["freshness", "offers", "low_price"] : ["freshness", "price", "offers"], "freshness"),
    layout: choice("layout", ["cards", "table"], "cards") as "cards" | "table",
    view,
    group,
    pageSize: Number(choice("pageSize", CHANNEL_PAGE_SIZES.map(String), "20")),
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}

export function channelHref(filters: ChannelFilters, changes: Partial<ChannelFilters> = {}): string {
  const next = { ...filters, page: 1, ...changes };
  if (next.view !== "merchants" && next.sort === "low_price") next.sort = "freshness";
  if (next.view === "merchants" && next.sort === "price") next.sort = "freshness";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (!value || (key === "pageSize" && value === 20) || (key === "catalog" && value === "subscriptions") || (key === "page" && value === 1) || (key === "view" && value === "compare")
      || (key === "group" && (value === "merged" || next.view === "merchants"))
      || (key === "layout" && (value === "cards" || next.view !== "merchants"))
      || (key === "sort" && value === "freshness") || (key === "stock" && value === "all")) continue;
    params.set(key, String(value));
  }
  return `/channels${params.size ? `?${params}` : ""}`;
}

export interface ChannelChip { key: string; label: string; clearHref: string }

/**
 * Every narrowing currently applied, as removable chips. Without this the page can
 * silently sit inside a filter the reader never chose, which is exactly what the
 * opaque specification lock used to do.
 */
export function activeChannelChips(filters: ChannelFilters): ChannelChip[] {
  const chips: ChannelChip[] = [];
  const add = (key: keyof ChannelFilters, label: string, cleared: string) => {
    chips.push({ key, label, clearHref: channelHref(filters, { [key]: cleared } as Partial<ChannelFilters>) });
  };
  if (filters.catalog === "resources") add("catalog", "周边与使用服务", "subscriptions");
  if (filters.catalog === "accounts") add("catalog", "未定档账号", "subscriptions");
  if (filters.category) add("category", CHANNEL_CATEGORIES.find(([value]) => value === filters.category)?.[1] ?? filters.category, "");
  if (filters.q) add("q", `搜索“${filters.q}”`, "");
  if (filters.platform) add("platform", CHANNEL_PLATFORMS.find(([value]) => value === filters.platform)?.[1] ?? filters.platform, "");
  if (filters.mode) add("mode", channelMode(filters.mode), "");
  if (filters.duration) add("duration", `${filters.duration} 天`, "");
  if (filters.warranty) add("warranty", channelWarranty(filters.warranty), "");
  if (filters.currency) add("currency", filters.currency, "");
  if (filters.stock === "available") add("stock", "仅已确认有货", "all");
  return chips;
}

export function channelMoney(value: string | null, currency: string): string {
  if (value === null || !Number.isFinite(Number(value))) return "暂无可比价";
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
}

export function channelTime(value: Date | string | null): string {
  if (!value) return "尚未核验";
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return "尚未核验";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai" }).format(time);
}
