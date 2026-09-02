import { canonicalProducts, type Database } from "@price-radar/database";

const PRODUCTS = [
  ["OpenAI", "chatgpt-plus", "ChatGPT Plus", "ChatGPT Plus"],
  ["OpenAI", "chatgpt-pro", "ChatGPT Pro", "ChatGPT Pro"],
  ["Anthropic", "claude-pro", "Claude Pro", "Claude Pro"],
  ["Anthropic", "claude-max-5x", "Claude Max 5x", "Claude Max"],
  ["Anthropic", "claude-max-20x", "Claude Max 20x", "Claude Max"],
  ["Google", "gemini-pro", "Google AI Pro", "Google AI Pro"],
  ["Google", "google-ai-ultra", "Google AI Ultra", "Google AI Ultra"],
  ["xAI", "supergrok", "SuperGrok", "SuperGrok"],
  ["Anysphere", "cursor-pro", "Cursor Pro", "Cursor Pro"],
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
  return PRODUCTS.length;
}
