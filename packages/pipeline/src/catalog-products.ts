import { sql } from "drizzle-orm";
import { canonicalProducts, type Database } from "@price-radar/database";

// Which shelf each product sits on. Stated here, once, rather than inferred later from
// brand and slug: that inference needed a negative rule for 其他 ("everything that is
// not OpenAI, not a mailbox, not …"), so a newly collected mailbox would have landed in
// 其他 silently. Adding a product to a category is now one word on its own line.
const PRODUCTS = [
  ["OpenAI", "chatgpt-plus", "ChatGPT Plus", "ChatGPT Plus", "chatgpt"],
  ["OpenAI", "chatgpt-pro", "ChatGPT Pro", "ChatGPT Pro", "chatgpt"],
  ["OpenAI", "chatgpt-team", "ChatGPT Team", "ChatGPT Team", "chatgpt"],
  ["OpenAI", "chatgpt-go", "ChatGPT Go", "ChatGPT Go", "chatgpt"],
  ["OpenAI", "codex-credits", "Codex Credits", "Codex Credits", "chatgpt"],
  ["Anthropic", "claude-pro", "Claude Pro", "Claude Pro", "claude"],
  ["Anthropic", "claude-max-5x", "Claude Max 5x", "Claude Max", "claude"],
  ["Anthropic", "claude-max-20x", "Claude Max 20x", "Claude Max", "claude"],
  ["Google", "gemini-pro", "Google AI Pro", "Google AI Pro", "gemini"],
  ["Google", "google-ai-ultra", "Google AI Ultra", "Google AI Ultra", "gemini"],
  ["xAI", "supergrok", "SuperGrok", "SuperGrok", "grok"],
  ["Anysphere", "cursor-pro", "Cursor Pro", "Cursor Pro", "other"],
  ["Perplexity", "perplexity-pro", "Perplexity Pro", "Perplexity Pro", "other"],
  ["X", "x-premium", "X Premium", "X Premium", "grok"],
] as const;

const ADDITIONAL_PRODUCTS = [
  ['OpenAI','chatgpt-pro-5x','ChatGPT Pro 5x','chatgpt'],
  ['OpenAI','chatgpt-pro-20x','ChatGPT Pro 20x','chatgpt'],
  ['Google','gemini-account','Gemini 账号（套餐待确认）','gemini'],
  ['OpenAI','chatgpt-account','ChatGPT 普通账号','chatgpt'],
  ['Anthropic','claude-account','Claude 普通账号 / 兑换号','claude'],
  ['xAI','grok-account','Grok 普通账号 / 体验号','grok'],
  ['xAI','supergrok-heavy','SuperGrok Heavy','grok'],
  ['Anysphere','cursor-account','Cursor 账号（套餐待确认）','other'],
  ['Amazon','kiro-pro','Kiro Pro / 额度','other'],
  ['Amazon','kiro-account','Kiro 普通账号','other'],
  ['Suno','suno-account','Suno 账号（套餐待确认）','other'],
  // Video generation names the category, the model names the product.
  ['ByteDance','dreamina-account','视频生成 · 即梦 Dreamina','video'],
  ['Runway','video-runway-max','视频生成 · Runway Max','video'],
  ['Runway','video-runway-pro','视频生成 · Runway Pro','video'],
  ['Kuaishou','video-kling','视频生成 · 可灵 Kling','video'],
  ['Google','resource-gmail','Gmail / Google 邮箱','mail'],
  ['Microsoft','resource-outlook','Outlook / Hotmail 邮箱','mail'],
  ['Apple','resource-icloud','iCloud 邮箱','mail'],
  ['Education','resource-education-email','教育邮箱','mail'],
  ['Apple','resource-apple-account','Apple ID / 苹果账号','other'],
  ['OpenAI','resource-openai-verification','OpenAI / ChatGPT 验证服务','verification'],
  ['Google','resource-google-verification','Google / Gemini 验证服务','verification'],
  ['Telegram','resource-telegram-premium','Telegram Premium','other'],
  // Shops sell guides and helper tools alongside subscriptions. They are real goods,
  // so they get their own entries instead of being dropped from the catalog.
  ['Guide','resource-tutorial','使用教程 / 攻略','other'],
  ['Tool','resource-tool','账号工具 / 助手','other'],
] as const;

export async function seedCanonicalProducts(db: Database): Promise<number> {
  await db
    .insert(canonicalProducts)
    .values(
      PRODUCTS.map(([brand, slug, displayName, planFamily, category]) => ({
        brand,
        slug,
        displayName,
        planFamily,
        category,
        billingPeriod: "month",
        baseDurationDays: 30,
      })),
    )
    // The category has to reach rows that already exist, exactly as the display name
    // does. These fourteen were all seeded long ago, so insert-only would have left every
    // one of them on the default shelf 其他 for ever. Billing fields stay untouched.
    .onConflictDoUpdate({
      target: canonicalProducts.slug,
      set: { category: sql`excluded.category` },
    });
  // This list is the naming authority. Renaming here has to reach a catalogue that
  // already holds the row, or 即梦 keeps its old name while the siblings created beside
  // it carry the category prefix. Checked before switching: every published display name
  // already matched this list exactly, so updating overwrites nothing anyone chose.
  await db.insert(canonicalProducts).values(ADDITIONAL_PRODUCTS.map(([brand,slug,displayName,category]) => ({
    brand,slug,displayName,category,planFamily:displayName,
  }))).onConflictDoUpdate({
    target: canonicalProducts.slug,
    set: { displayName: sql`excluded.display_name`, planFamily: sql`excluded.plan_family`, category: sql`excluded.category` },
  });
  return PRODUCTS.length + ADDITIONAL_PRODUCTS.length;
}
