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

export function familyRanges(prices: TransitModelPrice[]): Array<{ family: string; min: number; max: number }> {
  const groups = new Map<string, number[]>();
  for (const price of prices) {
    const value = price.multiplier !== null ? Number(price.multiplier) : price.inputPrice !== null ? Number(price.inputPrice) : Number.NaN;
    if (!Number.isFinite(value) || value < 0) continue;
    const family = modelFamily(price);
    groups.set(family, [...(groups.get(family) ?? []), value]);
  }
  return [...groups.entries()].map(([family, values]) => ({ family, min: Math.min(...values), max: Math.max(...values) })).sort((a, b) => a.min - b.min).slice(0, 4);
}

export function lowest(prices: TransitModelPrice[]): { value: number | null; family: string; isMultiplier: boolean } {
  const multiplierRows = prices.filter((price) => price.multiplier !== null && Number.isFinite(Number(price.multiplier)) && Number(price.multiplier) >= 0);
  const rows = multiplierRows.length ? multiplierRows : prices.filter((price) => price.inputPrice !== null && Number.isFinite(Number(price.inputPrice)) && Number(price.inputPrice) >= 0);
  const row = [...rows].sort((a, b) => Number(multiplierRows.length ? a.multiplier : a.inputPrice) - Number(multiplierRows.length ? b.multiplier : b.inputPrice))[0];
  return row ? { value: Number(multiplierRows.length ? row.multiplier : row.inputPrice), family: modelFamily(row), isMultiplier: multiplierRows.length > 0 } : { value: null, family: "暂无", isMultiplier: false };
}

