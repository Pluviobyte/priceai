import type { TransitModelPrice } from "./public-pricing";

export function modelFamily(price: TransitModelPrice): string {
  const text = `${price.modelCode} ${price.displayName}`.toLowerCase();
  if (text.includes("claude") || text.includes("anthropic")) return "Claude";
  if (text.includes("gemini") || text.includes("google")) return "Gemini";
  if (text.includes("grok") || text.includes("x-ai")) return "Grok";
  if (text.includes("deepseek")) return "DeepSeek";
  if (text.includes("glm") || text.includes("z-ai")) return "GLM";
  if (text.includes("kimi") || text.includes("moonshot")) return "Kimi";
  if (text.includes("qwen") || text.includes("alibaba")) return "千问";
  if (text.includes("image") || text.includes("flux") || text.includes("dall")) return "图片生成";
  if (text.includes("video") || text.includes("sora") || text.includes("veo")) return "视频生成";
  return "ChatGPT";
}

// A free model variant (OpenRouter's ":free", rate-limited previews) is not what a buyer pays
// for the family, so the minimum is the cheapest paid price; free counts only when nothing
// in the family is paid. A missing price is never read as free.
function paidFloor(values: number[]): number {
  const paid = values.filter((value) => value > 0);
  return paid.length ? Math.min(...paid) : 0;
}

export function familyRanges(prices: TransitModelPrice[]): Array<{ family: string; min: number; max: number }> {
  const groups = new Map<string, number[]>();
  for (const price of prices) {
    const value = price.multiplier !== null ? Number(price.multiplier) : price.inputPrice !== null ? Number(price.inputPrice) : Number.NaN;
    if (!Number.isFinite(value) || value < 0) continue;
    const family = modelFamily(price);
    groups.set(family, [...(groups.get(family) ?? []), value]);
  }
  return [...groups.entries()].map(([family, values]) => ({ family, min: paidFloor(values), max: Math.max(...values) })).sort((a, b) => a.min - b.min).slice(0, 4);
}

export function lowest(prices: TransitModelPrice[]): { value: number | null; family: string; isMultiplier: boolean; freeCount: number } {
  const multiplierRows = prices.filter((price) => price.multiplier !== null && Number.isFinite(Number(price.multiplier)) && Number(price.multiplier) >= 0);
  const rows = multiplierRows.length ? multiplierRows : prices.filter((price) => price.inputPrice !== null && Number.isFinite(Number(price.inputPrice)) && Number(price.inputPrice) >= 0);
  const amount = (price: TransitModelPrice) => Number(multiplierRows.length ? price.multiplier : price.inputPrice);
  const freeCount = rows.filter((price) => amount(price) === 0).length;
  const paid = rows.filter((price) => amount(price) > 0);
  const row = [...(paid.length ? paid : rows)].sort((a, b) => amount(a) - amount(b))[0];
  return row ? { value: amount(row), family: modelFamily(row), isMultiplier: multiplierRows.length > 0, freeCount } : { value: null, family: "暂无", isMultiplier: false, freeCount: 0 };
}
