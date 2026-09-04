export type OfficialSubscriptionBillingPeriod = "month" | "year" | "one_time";

export interface OfficialSubscriptionPlanCatalogItem {
  vendor: string;
  planCode: string;
  displayName: string;
  billingPeriod: OfficialSubscriptionBillingPeriod;
  officialUrl: string;
}

export interface OfficialSubscriptionRegionCatalogItem {
  countryCode: string;
  storefront: string;
  displayName: string;
  currency: string;
}

/**
 * 官方订阅采集与前台目录共享的套餐定义。
 * 价格不放在这里：金额只能来自带证据和核验时间的价格记录。
 */
export const OFFICIAL_SUBSCRIPTION_PLAN_CATALOG: readonly OfficialSubscriptionPlanCatalogItem[] = [
  { vendor: "openai", planCode: "chatgpt-go-monthly", displayName: "ChatGPT Go", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/11989085-what-is-chatgpt-go" },
  { vendor: "openai", planCode: "chatgpt-plus-monthly", displayName: "ChatGPT Plus", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus" },
  { vendor: "openai", planCode: "chatgpt-pro-5x-monthly", displayName: "ChatGPT Pro 5x", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro" },
  { vendor: "openai", planCode: "chatgpt-pro-20x-monthly", displayName: "ChatGPT Pro 20x", billingPeriod: "month", officialUrl: "https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro" },
  { vendor: "anthropic", planCode: "claude-pro-monthly", displayName: "Claude Pro", billingPeriod: "month", officialUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "anthropic", planCode: "claude-pro-annual", displayName: "Claude Pro Annual", billingPeriod: "year", officialUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "anthropic", planCode: "claude-max-5x-monthly", displayName: "Claude Max 5x", billingPeriod: "month", officialUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "anthropic", planCode: "claude-max-20x-monthly", displayName: "Claude Max 20x", billingPeriod: "month", officialUrl: "https://support.claude.com/en/articles/11049762-choosing-a-claude-ai-plan" },
  { vendor: "google", planCode: "google-ai-plus-monthly", displayName: "Google AI Plus", billingPeriod: "month", officialUrl: "https://one.google.com/about/google-ai-plans/" },
  { vendor: "google", planCode: "google-ai-pro-monthly", displayName: "Google AI Pro", billingPeriod: "month", officialUrl: "https://one.google.com/about/google-ai-plans/" },
  { vendor: "google", planCode: "google-ai-ultra-monthly", displayName: "Google AI Ultra", billingPeriod: "month", officialUrl: "https://one.google.com/about/google-ai-plans/" },
  { vendor: "xai", planCode: "supergrok-monthly", displayName: "SuperGrok", billingPeriod: "month", officialUrl: "https://x.ai/pricing" },
  { vendor: "xai", planCode: "supergrok-plus-monthly", displayName: "SuperGrok Plus", billingPeriod: "month", officialUrl: "https://x.ai/pricing" },
];

/** 首版地区对照范围。storefront 用于 Apple 公开商店 URL。 */
export const OFFICIAL_SUBSCRIPTION_REGION_CATALOG: readonly OfficialSubscriptionRegionCatalogItem[] = [
  { countryCode: "US", storefront: "us", displayName: "美国", currency: "USD" },
  { countryCode: "GB", storefront: "gb", displayName: "英国", currency: "GBP" },
  { countryCode: "AU", storefront: "au", displayName: "澳大利亚", currency: "AUD" },
  { countryCode: "CA", storefront: "ca", displayName: "加拿大", currency: "CAD" },
  { countryCode: "JP", storefront: "jp", displayName: "日本", currency: "JPY" },
  { countryCode: "IN", storefront: "in", displayName: "印度", currency: "INR" },
  { countryCode: "TR", storefront: "tr", displayName: "土耳其", currency: "TRY" },
  { countryCode: "BR", storefront: "br", displayName: "巴西", currency: "BRL" },
  { countryCode: "TW", storefront: "tw", displayName: "中国台湾", currency: "TWD" },
  { countryCode: "SG", storefront: "sg", displayName: "新加坡", currency: "SGD" },
  { countryCode: "PH", storefront: "ph", displayName: "菲律宾", currency: "PHP" },
  { countryCode: "ID", storefront: "id", displayName: "印度尼西亚", currency: "IDR" },
];
