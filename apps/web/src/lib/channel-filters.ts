export const CHANNEL_PLATFORMS = [
  ["", "全部模型"], ["OpenAI", "ChatGPT"], ["Anthropic", "Claude"],
  ["Google", "Gemini"], ["xAI", "Grok"], ["Anysphere", "Cursor"],
  ["Perplexity", "Perplexity"],
] as const;

export const CHANNEL_MODES = {
  recharge: "自己账号代充", finished_account: "成品账号", redeem_code: "兑换码 / 卡密",
  team_seat: "团队席位", shared_account: "共享账号", web_mirror: "网页镜像",
  reverse_proxy: "反代服务", short_term: "短期体验", unknown: "交付待确认",
} as const;

export const CHANNEL_WARRANTIES = {
  subscription_period: "订阅期质保", fixed_hours: "固定时长质保",
  first_login: "仅保首次登录", none: "无质保", unknown: "质保待确认",
} as const;

export type ChannelFilters = {
  q: string; platform: string; mode: string; duration: string; warranty: string;
  stock: string; currency: string; sort: string; view: string; page: number; spec: string;
};

export function parseChannelFilters(raw: Record<string, string | string[] | undefined>): ChannelFilters {
  const first = (key: string) => (Array.isArray(raw[key]) ? raw[key][0] : raw[key])?.trim() ?? "";
  const choice = (key: string, choices: readonly string[], fallback = "") => choices.includes(first(key)) ? first(key) : fallback;
  const page = Number(first("page"));
  const view = choice("view", ["products", "offers", "merchants"], "products");
  return {
    q: first("q").slice(0, 160),
    spec: /^[a-f0-9]{32}$/.test(first("spec")) ? first("spec") : "",
    platform: choice("platform", CHANNEL_PLATFORMS.map(([value]) => value)),
    mode: choice("mode", Object.keys(CHANNEL_MODES)),
    duration: choice("duration", ["7", "30", "90", "180", "365"]),
    warranty: choice("warranty", Object.keys(CHANNEL_WARRANTIES)),
    stock: choice("stock", ["all", "available"], "all"),
    currency: choice("currency", ["CNY", "USD", "HKD", "EUR", "JPY"]),
    sort: choice("sort", view === "merchants" ? ["freshness", "offers"] : ["freshness", "price", "offers"], "freshness"),
    view,
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 10000) : 1,
  };
}

export function channelHref(filters: ChannelFilters, changes: Partial<ChannelFilters> = {}): string {
  const next = { ...filters, page: 1, ...changes };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(next)) {
    if (!value || (key === "page" && value === 1) || (key === "view" && value === "products")
      || (key === "sort" && value === "freshness") || (key === "stock" && value === "all")) continue;
    params.set(key, String(value));
  }
  return `/channels${params.size ? `?${params}` : ""}`;
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
