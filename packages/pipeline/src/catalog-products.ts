import { canonicalProducts, type Database } from "@price-radar/database";

const PRODUCTS = [
  ["OpenAI", "chatgpt-plus", "ChatGPT Plus", "ChatGPT Plus"],
  ["OpenAI", "chatgpt-pro", "ChatGPT Pro", "ChatGPT Pro"],
  ["OpenAI", "chatgpt-team", "ChatGPT Team", "ChatGPT Team"],
  ["OpenAI", "chatgpt-go", "ChatGPT Go", "ChatGPT Go"],
  ["OpenAI", "codex-credits", "Codex Credits", "Codex Credits"],
  ["Anthropic", "claude-pro", "Claude Pro", "Claude Pro"],
  ["Anthropic", "claude-max-5x", "Claude Max 5x", "Claude Max"],
  ["Anthropic", "claude-max-20x", "Claude Max 20x", "Claude Max"],
  ["Google", "gemini-pro", "Google AI Pro", "Google AI Pro"],
  ["Google", "google-ai-ultra", "Google AI Ultra", "Google AI Ultra"],
  ["xAI", "supergrok", "SuperGrok", "SuperGrok"],
  ["Anysphere", "cursor-pro", "Cursor Pro", "Cursor Pro"],
  ["Perplexity", "perplexity-pro", "Perplexity Pro", "Perplexity Pro"],
  ["X", "x-premium", "X Premium", "X Premium"],
] as const;

const ADDITIONAL_PRODUCTS = [
  ['OpenAI','chatgpt-pro-5x','ChatGPT Pro 5x'],
  ['OpenAI','chatgpt-pro-20x','ChatGPT Pro 20x'],
  ['Google','gemini-account','Gemini 账号（套餐待确认）'],
  ['OpenAI','chatgpt-account','ChatGPT 普通账号'],
  ['Anthropic','claude-account','Claude 普通账号 / 兑换号'],
  ['xAI','grok-account','Grok 普通账号 / 体验号'],
  ['xAI','supergrok-heavy','SuperGrok Heavy'],
  ['Anysphere','cursor-account','Cursor 账号（套餐待确认）'],
  ['Amazon','kiro-pro','Kiro Pro / 额度'],
  ['Amazon','kiro-account','Kiro 普通账号'],
  ['Suno','suno-account','Suno 账号（套餐待确认）'],
  ['ByteDance','dreamina-account','即梦 / Dreamina 账号与积分'],
  ['Google','resource-gmail','Gmail / Google 邮箱'],
  ['Microsoft','resource-outlook','Outlook / Hotmail 邮箱'],
  ['Apple','resource-icloud','iCloud 邮箱'],
  ['Education','resource-education-email','教育邮箱'],
  ['Apple','resource-apple-account','Apple ID / 苹果账号'],
  ['OpenAI','resource-openai-verification','OpenAI / ChatGPT 验证服务'],
  ['Google','resource-google-verification','Google / Gemini 验证服务'],
  ['Telegram','resource-telegram-premium','Telegram Premium'],
] as const;

export async function seedCanonicalProducts(db: Database): Promise<number> {
  await db
    .insert(canonicalProducts)
    .values(
      PRODUCTS.map(([brand, slug, displayName, planFamily]) => ({
        brand,
        slug,
        displayName,
        planFamily,
        billingPeriod: "month",
        baseDurationDays: 30,
      })),
    )
    .onConflictDoNothing({ target: canonicalProducts.slug });
  await db.insert(canonicalProducts).values(ADDITIONAL_PRODUCTS.map(([brand,slug,displayName]) => ({
    brand,slug,displayName,planFamily:displayName,
  }))).onConflictDoNothing({target:canonicalProducts.slug});
  return PRODUCTS.length + ADDITIONAL_PRODUCTS.length;
}
