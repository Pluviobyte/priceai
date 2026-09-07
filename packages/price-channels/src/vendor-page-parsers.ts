import { detectCurrencyFromDisplay, parseLocalizedAmount } from "@price-radar/price-channels/storefront-parser";

function visibleText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;| /gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeJsonStringBody(body: string): string {
  try {
    return JSON.parse(`"${body}"`) as string;
  } catch {
    return body;
  }
}

// ---------------------------------------------------------------------------
// Google Play：公开页只给出应用内购买的价格区间，不给逐 SKU 价格。
// ---------------------------------------------------------------------------

export interface GooglePlayInAppRange {
  lowerText: string;
  upperText: string;
  lower: number | null;
  upper: number | null;
  currency: string | null;
}

/** 解析 Google Play 页面内嵌数据里的 "X - Y per item" 区间（页面需以 hl=en 请求）。 */
export function parseGooglePlayInAppRange(html: string, fallbackCurrency?: string): GooglePlayInAppRange | null {
  const match = html.match(/"((?:[^"\\]|\\.){1,60}?)\s+-\s+((?:[^"\\]|\\.){1,60}?)\s+per item"/);
  if (!match) return null;
  const lowerText = decodeJsonStringBody(match[1]!).replace(/ /g, " ").trim();
  const upperText = decodeJsonStringBody(match[2]!).replace(/ /g, " ").trim();
  const currency = detectCurrencyFromDisplay(lowerText) ?? detectCurrencyFromDisplay(upperText) ?? fallbackCurrency ?? null;
  return {
    lowerText,
    upperText,
    currency,
    lower: currency ? parseLocalizedAmount(lowerText, currency) : null,
    upper: currency ? parseLocalizedAmount(upperText, currency) : null,
  };
}

// ---------------------------------------------------------------------------
// Google AI 套餐：gemini.google/{country}/subscriptions/ 服务端渲染各国本币价。
// ---------------------------------------------------------------------------

export type GeminiPlanKey = "plus" | "pro" | "ultra_5x" | "ultra_20x";

export interface GeminiSubscriptionPlanPrice {
  planKey: GeminiPlanKey;
  planName: string;
  amountText: string;
  amount: number | null;
  currency: string | null;
  periodConfirmed: boolean;
  priceText: string;
}

export interface GeminiSubscriptionPageParse {
  /** canonical 链接里的国家段；美国默认页没有国家段时返回 "US"。 */
  canonicalCountry: string | null;
  plans: GeminiSubscriptionPlanPrice[];
  cardCount: number;
}

const MONTHLY_MARKER = /(?:\/\s*(?:month|mo\b|mês|mes\b|monat|maand|mois|mese|månad|måned|mies\b|miesiąc|ay\b|bulan|월|月|tháng|เดือน|kk\b|hónap|měsíc|luna|mesec|mjesec|ماه|شهر|חודש|माह|महीना)|per\s+month|monthly|par\s+mois|al\s+mes|por\s+mes|por\s+mês|pro\s+monat|每月|每個月|매월|mỗi tháng|ต่อเดือน|ayda|per bulan|mensile|mensual|mensuel|maandelijks|månedlig|månadsvis|في الشهر|شهريًا|شهرياً|فی ماہ|ماهانه|לחודש|месец|месечно|на місяць|měsíčně|mesačne|mjesečno|kuukaudessa|kuus|μήνα|\/\s*hó(?!\p{L})|\/\s*md\.?|mėn\.?|mēnesī|per\s+måned|pr\.\s*måned|per\s+maand|\/\s*міс\.?|lună)/iu;

function amountsInBlock(block: string): string[] {
  return [...block.matchAll(/<span class="price-amount">([^<]*)<\/span>/g)].map((match) => match[1]!.replace(/ /g, " ").trim());
}

export function parseGeminiSubscriptionPage(html: string, fallbackCurrency?: string): GeminiSubscriptionPageParse {
  const canonical = html.match(/<link rel="canonical" href="https:\/\/gemini\.google\/(?:([a-z]{2})\/)?subscriptions\/?[^"]*"/i);
  const canonicalCountry = canonical ? (canonical[1] ?? "us").toUpperCase() : null;
  const cards = html.split(/(?=<div class="_card_)/);
  const plans: GeminiSubscriptionPlanPrice[] = [];
  let cardCount = 0;
  for (const card of cards) {
    const logo = card.match(/class="_cardLogoText[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const planName = logo ? visibleText(logo[1]!) : "";
    // The live page appends a footnote marker (e.g. "Google AI Plus 1") to the plan name.
    const tier = planName.match(/^Google AI (Plus|Pro|Ultra)(?:\s*\d+)?$/)?.[1];
    if (!tier) continue;
    cardCount += 1;
    const title = card.match(/class="_cardPricingTitle[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const subtitle = card.match(/class="_cardPricingSubtitle[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const titleText = title ? visibleText(title[1]!) : "";
    const subtitleText = subtitle ? visibleText(subtitle[1]!) : "";
    const titleAmounts = title ? amountsInBlock(title[1]!) : [];
    const subtitleAmounts = subtitle ? [...new Set(amountsInBlock(subtitle[1]!))] : [];
    const currency = detectCurrencyFromDisplay(titleText) ?? detectCurrencyFromDisplay(subtitleText) ?? fallbackCurrency ?? null;
    const build = (planKey: GeminiPlanKey, amountText: string | undefined, priceText: string): GeminiSubscriptionPlanPrice => ({
      planKey,
      planName,
      amountText: amountText ?? "",
      amount: amountText && currency ? parseLocalizedAmount(amountText, currency) : null,
      currency,
      periodConfirmed: MONTHLY_MARKER.test(priceText),
      priceText,
    });
    if (tier === "Plus") plans.push(build("plus", titleAmounts[0], titleText));
    else if (tier === "Pro") plans.push(build("pro", titleAmounts[0], titleText));
    else {
      // Bind each price to its own explicit usage label, never its position in the card.
      const segments = (subtitle?.[1] ?? "").split(/(?=<span class="price">)/);
      for (const segment of segments) {
        const text = visibleText(segment);
        const labels = [...text.matchAll(/(?:^|[^0-9])(5|20)\s*[x×倍]/gi)].map(match => match[1]);
        const values = amountsInBlock(segment);
        if (new Set(labels).size !== 1 || values.length !== 1) continue;
        const key: GeminiPlanKey = labels[0] === "5" ? "ultra_5x" : "ultra_20x";
        if (!plans.some(plan => plan.planKey === key)) plans.push(build(key, values[0], text));
      }
    }
  }
  return { canonicalCountry, plans, cardCount };
}

// ---------------------------------------------------------------------------
// OpenAI：定价页调用的匿名接口 /backend-anon/checkout_pricing_config/configs/{country}
// ---------------------------------------------------------------------------

export interface OpenAiCheckoutPlanPrice {
  configKey: string;
  planCode: string;
  interval: "month";
  amount: number;
  tax: string | null;
  pspOverride: { amount: number; tax: string | null } | null;
}

export interface OpenAiCheckoutConfigParse {
  status: "ok" | "not_found" | "invalid";
  countryCode: string | null;
  currency: string | null;
  taxType: string | null;
  /** 部分国家的配置直接给出税率百分比。 */
  taxPercent: number | null;
  rolloutGate: string | null;
  prices: OpenAiCheckoutPlanPrice[];
  /** Plus 年付在配置里以“每月折合金额”出现，只作证据保存，不写成年付价。 */
  plusAnnualMonthlyEquivalent: { amount: number; tax: string | null } | null;
  promos: Record<string, unknown>;
  unknownKeys: string[];
  detail: string | null;
}

export const OPENAI_CHECKOUT_PLAN_KEYS: Readonly<Record<string, string>> = {
  go: "chatgpt-go-monthly",
  plus: "chatgpt-plus-monthly",
  prolite: "chatgpt-pro-5x-monthly",
  pro: "chatgpt-pro-20x-monthly",
};

const OPENAI_KNOWN_NON_PLAN_KEYS = new Set([
  "free", "free_workspace", "business", "business_prolite", "business_non_profit", "sci", "promos", "symbol", "symbol_code",
  "tax_type", "tax_percent", "vat_display", "minor_unit_exponent", "amount_per_credit", "codex_rate_limit_reset",
  "pricing_rollout_gate", "business_currency_override",
]);

function readInterval(value: unknown): { amount: number; tax: string | null; pspOverride: { amount: number; tax: string | null } | null } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.amount !== "number" && !(typeof record.amount === "string" && /^\d+(?:\.\d+)?$/.test(record.amount))) return null;
  const amount = Number(record.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const tax = typeof record.tax === "string" ? record.tax : null;
  const override = record.psp_override && typeof record.psp_override === "object" ? record.psp_override as Record<string, unknown> : null;
  const overrideAmount = override ? Number(override.amount) : NaN;
  return {
    amount,
    tax,
    pspOverride: override && Number.isFinite(overrideAmount) ? { amount: overrideAmount, tax: typeof override.tax === "string" ? override.tax : null } : null,
  };
}

export function parseOpenAiCheckoutConfig(text: string): OpenAiCheckoutConfigParse {
  const empty: OpenAiCheckoutConfigParse = {
    status: "invalid", countryCode: null, currency: null, taxType: null, taxPercent: null, rolloutGate: null, prices: [],
    plusAnnualMonthlyEquivalent: null, promos: {}, unknownKeys: [], detail: null,
  };
  let data: unknown;
  try {
    data = JSON.parse(text.trim());
  } catch {
    return empty;
  }
  if (!data || typeof data !== "object") return empty;
  const record = data as Record<string, unknown>;
  if (typeof record.detail === "string") {
    return { ...empty, status: /not found/i.test(record.detail) ? "not_found" : "invalid", detail: record.detail };
  }
  const config = record.currency_config;
  if (!config || typeof config !== "object") return empty;
  const currencyConfig = config as Record<string, unknown>;
  const prices: OpenAiCheckoutPlanPrice[] = [];
  for (const [configKey, planCode] of Object.entries(OPENAI_CHECKOUT_PLAN_KEYS)) {
    const plan = currencyConfig[configKey];
    if (!plan || typeof plan !== "object") continue;
    const month = readInterval((plan as Record<string, unknown>).month);
    if (!month) continue;
    prices.push({ configKey, planCode, interval: "month", amount: month.amount, tax: month.tax, pspOverride: month.pspOverride });
  }
  const plusYear = currencyConfig.plus && typeof currencyConfig.plus === "object"
    ? readInterval((currencyConfig.plus as Record<string, unknown>).year)
    : null;
  const unknownKeys = Object.keys(currencyConfig).filter((key) => !(key in OPENAI_CHECKOUT_PLAN_KEYS) && !OPENAI_KNOWN_NON_PLAN_KEYS.has(key));
  return {
    status: "ok",
    countryCode: typeof record.country_code === "string" ? record.country_code.toUpperCase() : null,
    currency: typeof currencyConfig.symbol_code === "string" ? currencyConfig.symbol_code : null,
    taxType: typeof currencyConfig.tax_type === "string" ? currencyConfig.tax_type : null,
    taxPercent: Number.isFinite(Number(currencyConfig.tax_percent)) && currencyConfig.tax_percent !== null && currencyConfig.tax_percent !== undefined ? Number(currencyConfig.tax_percent) : null,
    rolloutGate: typeof currencyConfig.pricing_rollout_gate === "string" && currencyConfig.pricing_rollout_gate ? currencyConfig.pricing_rollout_gate : null,
    prices,
    plusAnnualMonthlyEquivalent: plusYear ? { amount: plusYear.amount, tax: plusYear.tax } : null,
    promos: currencyConfig.promos && typeof currencyConfig.promos === "object" ? currencyConfig.promos as Record<string, unknown> : {},
    unknownKeys,
    detail: null,
  };
}
