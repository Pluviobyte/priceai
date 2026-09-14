import { sql } from "drizzle-orm";
import { canonicalProducts, type Database } from "@price-radar/database";

// Which shelf each product sits on. Stated here, once, rather than inferred later from
// brand and slug: that inference needed a negative rule for 其他 ("everything that is
// not OpenAI, not a mailbox, not …"), so a newly collected mailbox would have landed in
// 其他 silently. Adding a product to a category is now one word on its own line.
const PRODUCTS = [
  ["OpenAI", "chatgpt-plus", "ChatGPT Plus", "ChatGPT Plus", "chatgpt", "subscription"],
  ["OpenAI", "chatgpt-pro", "ChatGPT Pro", "ChatGPT Pro", "chatgpt", "subscription"],
  ["OpenAI", "chatgpt-team", "ChatGPT Team", "ChatGPT Team", "chatgpt", "subscription"],
  ["OpenAI", "chatgpt-go", "ChatGPT Go", "ChatGPT Go", "chatgpt", "subscription"],
  ["OpenAI", "codex-credits", "Codex Credits", "Codex Credits", "chatgpt", "api"],
  ["Anthropic", "claude-pro", "Claude Pro", "Claude Pro", "claude", "subscription"],
  ["Anthropic", "claude-max-5x", "Claude Max 5x", "Claude Max", "claude", "subscription"],
  ["Anthropic", "claude-max-20x", "Claude Max 20x", "Claude Max", "claude", "subscription"],
  ["Google", "gemini-pro", "Google AI Pro", "Google AI Pro", "gemini", "subscription"],
  ["Google", "google-ai-ultra", "Google AI Ultra", "Google AI Ultra", "gemini", "subscription"],
  ["xAI", "supergrok", "SuperGrok", "SuperGrok", "grok", "subscription"],
  ["Anysphere", "cursor-pro", "Cursor Pro", "Cursor Pro", "other", "subscription"],
  ["Perplexity", "perplexity-pro", "Perplexity Pro", "Perplexity Pro", "other", "subscription"],
  ["X", "x-premium", "X Premium", "X Premium", "grok", "subscription"],
] as const;

const ADDITIONAL_PRODUCTS = [
  ['OpenAI','chatgpt-pro-5x','ChatGPT Pro 5x','chatgpt','subscription'],
  ['OpenAI','chatgpt-pro-20x','ChatGPT Pro 20x','chatgpt','subscription'],
  ['Google','gemini-account','Gemini 账号（套餐待确认）','gemini','account'],
  ['OpenAI','chatgpt-account','ChatGPT 普通账号','chatgpt','account'],
  ['Anthropic','claude-account','Claude 普通账号 / 兑换号','claude','account'],
  ['xAI','grok-account','Grok 普通账号 / 体验号','grok','account'],
  ['xAI','supergrok-heavy','SuperGrok Heavy','grok','subscription'],
  ['Anysphere','cursor-account','Cursor 账号（套餐待确认）','other','account'],
  ['Amazon','kiro-pro','Kiro Pro / 额度','other','subscription'],
  ['Amazon','kiro-account','Kiro 普通账号','other','account'],
  ['Suno','suno-account','Suno 账号（套餐待确认）','other','account'],
  // Video generation names the category, the model names the product.
  ['ByteDance','dreamina-account','视频生成 · 即梦 Dreamina','video','account'],
  ['Runway','video-runway-max','视频生成 · Runway Max','video','subscription'],
  ['Runway','video-runway-pro','视频生成 · Runway Pro','video','subscription'],
  ['Kuaishou','video-kling','视频生成 · 可灵 Kling','video','subscription'],
  ['Google','resource-gmail','Gmail / Google 邮箱','mail','email'],
  ['Microsoft','resource-outlook','Outlook / Hotmail 邮箱','mail','email'],
  ['Apple','resource-icloud','iCloud 邮箱','mail','email'],
  ['Education','resource-education-email','教育邮箱','mail','email'],
  ['Apple','resource-apple-account','Apple ID / 苹果账号','other','account'],
  ['OpenAI','resource-openai-verification','OpenAI / ChatGPT 验证服务','verification','phone'],
  ['Google','resource-google-verification','Google / Gemini 验证服务','verification','phone'],
  ['Telegram','resource-telegram-premium','Telegram Premium','other','subscription'],
  // Shops sell guides and helper tools alongside subscriptions. They are real goods,
  // so they get their own entries instead of being dropped from the catalog.
  ['Guide','resource-tutorial','使用教程 / 攻略','other','tool'],
  ['Tool','resource-tool','账号工具 / 助手','other','tool'],
] as const;

export async function seedCanonicalProducts(db: Database): Promise<number> {
  await db
    .insert(canonicalProducts)
    .values(
      PRODUCTS.map(([brand, slug, displayName, planFamily, category, family]) => ({
        brand,
        slug,
        displayName,
        planFamily,
        category,
        family,
        billingPeriod: "month",
        baseDurationDays: 30,
      })),
    )
    // The category has to reach rows that already exist, exactly as the display name
    // does. These fourteen were all seeded long ago, so insert-only would have left every
    // one of them on the default shelf 其他 for ever. Billing fields stay untouched.
    .onConflictDoUpdate({
      target: canonicalProducts.slug,
      set: { category: sql`excluded.category`, family: sql`excluded.family` },
    });
  // This list is the naming authority. Renaming here has to reach a catalogue that
  // already holds the row, or 即梦 keeps its old name while the siblings created beside
  // it carry the category prefix. Checked before switching: every published display name
  // already matched this list exactly, so updating overwrites nothing anyone chose.
  await db.insert(canonicalProducts).values(ADDITIONAL_PRODUCTS.map(([brand,slug,displayName,category,family]) => ({
    brand,slug,displayName,category,family,planFamily:displayName,
  }))).onConflictDoUpdate({
    target: canonicalProducts.slug,
    set: { displayName: sql`excluded.display_name`, planFamily: sql`excluded.plan_family`,
      category: sql`excluded.category`, family: sql`excluded.family` },
  });
  return PRODUCTS.length + ADDITIONAL_PRODUCTS.length;
}
