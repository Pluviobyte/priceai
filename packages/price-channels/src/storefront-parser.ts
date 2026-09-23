export interface AppStorePriceListing {
  rawPlanName: string;
  displayAmount: string;
  amount: number;
}

function decodeInlineHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;|&#47;/gi, "/")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleTextFromHtml(html: string): string {
  return decodeInlineHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " "),
  );
}

export function extractOfficialPagePrice(html: string, requiredTerms: readonly string[]): number | null {
  const normalizedTerms = requiredTerms.join(" ").toLowerCase();
  if (normalizedTerms === "supergrok" || normalizedTerms === "supergrok plus") {
    return extractSuperGrokMonthlyPrice(html, normalizedTerms);
  }
  // OpenAI pages discuss several dollar prices in the same paragraph. Distance
  // from the article title cannot establish which tier or billing period owns one.
  if (normalizedTerms.includes("chatgpt plus")) return extractChatGptPlanPrice(html, "chatgpt-plus-monthly");
  if (normalizedTerms.includes("chatgpt pro")) {
    const tier = normalizedTerms.match(/\b(5|20)x\b/)?.[1];
    return tier ? extractChatGptPlanPrice(html, `chatgpt-pro-${tier}x-monthly`) : null;
  }
  const [anchorTerm, ...nearbyTerms] = requiredTerms;
  if (!anchorTerm) return null;
  const visibleText = visibleTextFromHtml(html);
  const normalizedText = visibleText.toLocaleLowerCase("en-US");
  const normalizedAnchor = anchorTerm.toLocaleLowerCase("en-US");
  const candidates: Array<{ amount: number; score: number }> = [];
  let anchorIndex = normalizedText.indexOf(normalizedAnchor);
  while (anchorIndex >= 0) {
    const windowStart = Math.max(0, anchorIndex - 120);
    const windowEnd = Math.min(visibleText.length, anchorIndex + normalizedAnchor.length + 500);
    const textWindow = visibleText.slice(windowStart, windowEnd);
    const normalizedWindow = normalizedText.slice(windowStart, windowEnd);
    if (nearbyTerms.every((term) => normalizedWindow.includes(term.toLocaleLowerCase("en-US")))) {
      const pricePattern = /(?:US\s*)?\$\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/gi;
      for (const match of textWindow.matchAll(pricePattern)) {
        const amount = Number((match[1] ?? "").replaceAll(",", ""));
        if (!Number.isFinite(amount) || amount <= 0) continue;
        const globalPriceIndex = windowStart + (match.index ?? 0);
        const anchorEnd = anchorIndex + normalizedAnchor.length;
        const distance = Math.abs(globalPriceIndex - anchorEnd);
        candidates.push({ amount, score: globalPriceIndex >= anchorEnd ? distance : distance + 500 });
      }
    }
    anchorIndex = normalizedText.indexOf(normalizedAnchor, anchorIndex + normalizedAnchor.length);
  }
  return candidates.sort((left, right) => left.score - right.score)[0]?.amount ?? null;
}

/** xAI price cards are identified by their exact heading, not a name prefix. */
function extractSuperGrokMonthlyPrice(html: string, normalizedPlanName: string): number | null {
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const amounts = new Set<number>();
  for (let index = 0; index < headings.length; index++) {
    const heading = headings[index]!;
    if (visibleTextFromHtml(heading[2]!).toLowerCase() !== normalizedPlanName) continue;
    const start = heading.index! + heading[0].length;
    const card = visibleTextFromHtml(html.slice(start, headings[index + 1]?.index ?? html.length));
    // An annual payment expressed as a monthly equivalent is a different offer.
    if (/\b(?:annual(?:ly)?|year(?:ly)?)\b/i.test(card)) continue;
    for (const price of card.matchAll(/(?<![\w$])(?:US\s*\$|USD\s*\$?|\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:USD\s*)?(?:\/\s*month\b|per\s+month\b)/gi)) {
      const amount = Number(price[1]!.replaceAll(",", ""));
      if (Number.isFinite(amount) && amount > 0) amounts.add(amount);
    }
  }
  return amounts.size === 1 ? [...amounts][0]! : null;
}

/** A monthly OpenAI quote requires the plan, amount and period in the same clause. */
export function extractChatGptPlanPrice(html: string, planCode: string): number | null {
  const requestedTier = planCode.match(/^chatgpt-pro-(5|20)x-monthly$/)?.[1];
  if (planCode !== "chatgpt-plus-monthly" && !requestedTier) return null;
  const text = visibleTextFromHtml(html);
  if (!/\bChatGPT\b/i.test(text)) return null;
  // Stop at every plan reference, including comparison targets such as "than
  // Plus", so neither a neighboring card nor a second Pro clause can supply a price.
  const mentions = [...text.matchAll(/\b(?:ChatGPT\s+)?(Go|Plus|Pro)(?:\s+(5|20)x)?\b/gi)];
  const amounts = new Set<number>();
  for (let index = 0; index < mentions.length; index++) {
    const mention = mentions[index]!;
    const kind = mention[1]!.toLowerCase();
    if (kind !== (requestedTier ? "pro" : "plus")) continue;
    const start = mention.index! + mention[0].length;
    const clause = text.slice(start, Math.min(mentions[index + 1]?.index ?? text.length, start + 220));
    // A displayed monthly equivalent with an annual payment is not a monthly subscription.
    if (/\b(?:annual(?:ly)?|year(?:ly)?)\b/i.test(clause)) continue;
    const tiers = new Set([mention[2], ...[...clause.matchAll(/\b(5|20)x\b/gi)].map(match => match[1])].filter(Boolean));
    if (requestedTier && (tiers.size !== 1 || !tiers.has(requestedTier))) continue;
    // Plain $ is accepted only as an OpenAI USD reference. A$, S$, HK$, etc.
    // must not become USD, and annual or unspecified amounts are not month fees.
    const prices = clause.matchAll(/(?<![\w$])(?:US\s*\$|USD\s*\$?|\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:USD\s*)?(?:\/\s*month\b|per\s+month\b)/gi);
    for (const price of prices) {
      const amount = Number(price[1]!.replaceAll(",", ""));
      if (Number.isFinite(amount) && amount > 0) amounts.add(amount);
    }
  }
  return amounts.size === 1 ? [...amounts][0]! : null;
}

export function officialPageConfirmsPrice(html: string, requiredTerms: readonly string[], amount: number): boolean {
  return extractOfficialPagePrice(html, requiredTerms) === amount;
}

function parseNumber(value: string, currency: string): number | null {
  return parseLocalizedAmount(value, currency);
}

export function parseAppStorePriceListings(html: string, currency: string): AppStorePriceListing[] {
  const listings: AppStorePriceListing[] = [];
  const pairPattern = /<span\b[^>]*>([^<]*)<\/span>\s*<span\b[^>]*>([^<]*)<\/span>/gi;
  for (const match of html.matchAll(pairPattern)) {
    const rawPlanName = decodeInlineHtml(match[1] ?? "");
    const displayAmount = decodeInlineHtml(match[2] ?? "");
    if (!rawPlanName || !displayAmount || !/^(ChatGPT|Claude|Gemini|Google AI|SuperGrok)/i.test(rawPlanName)) continue;
    const amount = parseNumber(displayAmount, currency);
    if (amount === null) continue;
    listings.push({ rawPlanName, displayAmount, amount });
  }
  return listings;
}

export function selectAppStorePlanPrice(
  listings: readonly AppStorePriceListing[],
  rawPlanName: string,
  selection: "first" | "lowest" = "first",
  options: { mustBeLessThanPlanName?: string } = {},
): AppStorePriceListing | null {
  const matches = listings.filter((listing) => listing.rawPlanName.toLocaleLowerCase("en-US") === rawPlanName.toLocaleLowerCase("en-US"));
  if (!matches.length) return null;
  const selected = selection === "lowest"
    ? [...matches].sort((left, right) => left.amount - right.amount)[0] ?? null
    : matches[0] ?? null;
  if (!selected || !options.mustBeLessThanPlanName) return selected;
  const upperBound = listings
    .filter((listing) => listing.rawPlanName.toLocaleLowerCase("en-US") === options.mustBeLessThanPlanName!.toLocaleLowerCase("en-US"))
    .sort((left, right) => left.amount - right.amount)[0];
  return upperBound && selected.amount < upperBound.amount ? selected : null;
}

/** Only accept a USD monthly price inside the Go pricing section, never a neighboring tier. */
export function extractChatGptGoWebPrice(html: string): number | null {
  const text = visibleTextFromHtml(html);
  const section = text.match(/\bGo\s+Expanded access\b([\s\S]*?)(?=\bPlus\b|$)/i)?.[1];
  if (!section) return null;
  // Explicit US currency only; a localized dollar sign alone is ambiguous.
  const match = section.match(/(?:US\$\s*|USD\s*\$?\s*)([0-9]+(?:\.[0-9]{1,2})?)\s*(?:USD\s*)?(?:\/|per)\s*month/i)
    ?? section.match(/\$\s*([0-9]+(?:\.[0-9]{1,2})?)\s*USD\s*(?:\/|per)\s*month/i);
  const amount = match ? Number(match[1]) : NaN;
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** Keep Pro monthly/annual and Max tiers in their own table cells. */
export function extractClaudePlanPrice(html: string, planCode: string): number | null {
  const names: Record<string, string> = { "claude-pro-monthly": "Pro", "claude-pro-annual": "Pro", "claude-max-5x-monthly": "Max 5x", "claude-max-20x-monthly": "Max 20x" };
  const name = names[planCode];
  if (!name) return null;
  const requestedPeriod = planCode.endsWith("annual") ? "year" : "month";
  const amounts = new Set<number>();
  const visible = visibleTextFromHtml(html);
  // Help articles bind the plan, currency and billing period in the same sentence.
  if (planCode === "claude-pro-monthly") {
    for (const match of visible.matchAll(/Pro plan is available for \$([0-9]+(?:\.[0-9]{1,2})?) per month \(US\)/g)) amounts.add(Number(match[1]));
  }
  if (planCode.startsWith("claude-max-") && /prices are for web subscriptions only/i.test(visible)) {
    const tier = planCode === "claude-max-5x-monthly" ? "5" : "20";
    const pattern = new RegExp(`Max ${tier}x\\s*:\\s*\\$([0-9]+(?:\\.[0-9]{1,2})?) per month`, "g");
    for (const match of visible.matchAll(pattern)) amounts.add(Number(match[1]));
  }
  if (planCode === "claude-pro-annual") {
    const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    for (const match of markup.matchAll(/<([a-z][a-z0-9]*)\b(?=[^>]*\bdata-plan=["']pro_annual["'])(?=[^>]*\bdata-plan-field=["']amount_total["'])[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const amount = visibleTextFromHtml(match[2]!).match(/^\$([0-9]+(?:\.[0-9]{1,2})?)$/);
      if (amount && /^\s*billed up front/i.test(visibleTextFromHtml(markup.slice(match.index! + match[0].length, match.index! + match[0].length + 100)))) amounts.add(Number(amount[1]));
    }
  }
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(table => table[1]!);
  for (const table of tables.length ? tables : [html]) {
    // The live guide uses ordinary td elements for its bold column headings.
    const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
      [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(cell => visibleTextFromHtml(cell[1]!)));
    const headers = rows.find(row => row.includes("Plan") && row.includes("Price"));
    const nameIndex = headers?.indexOf("Plan") ?? 0;
    const priceIndex = headers?.indexOf("Price") ?? 1;
    const intervalIndex = headers?.indexOf("Billing Interval") ?? -1;
    for (const cells of rows) {
      const priceCell = cells[priceIndex];
      if (cells[nameIndex] !== name || !priceCell) continue;
      if (/\b(?:from|starting|up to)\b|[–—]|\$\s*\d+(?:\.\d+)?\s*-/.test(priceCell.toLowerCase())) continue;
      const interval = intervalIndex >= 0 ? cells[intervalIndex]?.toLowerCase() : undefined;
      if (requestedPeriod === "month" && (/\b(?:annual(?:ly)?|yearly)\b/i.test(priceCell) || /^(?:annual(?:ly)?|yearly)$/.test(interval ?? ""))) continue;
      if (requestedPeriod === "year" && interval === "monthly") continue;
      for (const match of priceCell.matchAll(/(?<![\w$])(?:US\s*\$|USD\s*\$?|\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:USD\s*)?(?:\/|per)\s*(month|year)\b/gi)) {
        if (match[2]?.toLowerCase() !== requestedPeriod) continue;
        const amount = Number(match[1]!.replaceAll(",", ""));
        if (Number.isFinite(amount) && amount > 0) amounts.add(amount);
      }
      // A bare Max amount is usable only with the same row's explicit billing column.
      const expectedInterval = requestedPeriod === "month" ? "monthly" : "annual";
      const bare = priceCell.match(/^(?:US\s*\$|USD\s*\$?|\$)\s*([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:USD)?$/i);
      if (interval === expectedInterval && bare) {
        const amount = Number(bare[1]!.replaceAll(",", ""));
        if (Number.isFinite(amount) && amount > 0) amounts.add(amount);
      }
    }
  }
  return amounts.size === 1 ? [...amounts][0]! : null;
}

export function hasAmbiguousAppStorePrices(listings: readonly AppStorePriceListing[], name: string): boolean {
  return new Set(listings.filter(row => row.rawPlanName.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US")).map(row => row.amount)).size > 1;
}

// ---------------------------------------------------------------------------
// 2026-09-07：结构化 App Store 解析、币种感知金额解析与同名重复项规则。
// ---------------------------------------------------------------------------

const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

/**
 * 按币种解析本地化金额字符串。分隔符规则：同时出现逗号和句点时，靠后的是小数点；
 * 只有一种分隔符时，出现多次或后跟三位数字视为千分位（三位小数币种除外），否则视为小数点。
 * 空格与不间断空格一律视为千分位。印尼 ribu / juta 缩写按千、百万放大。
 */
export function parseLocalizedAmount(display: string, currency: string): number | null {
  const compact = display.replace(/[  ]/g, " ").trim();
  const match = compact.match(/[0-9](?:[0-9.,]|\s(?=[0-9]{3}(?![0-9])))*/);
  if (!match) return null;
  let raw = match[0].replace(/\s/g, "");
  const suffix = compact.slice((match.index ?? 0) + match[0].length).trim().toLowerCase();
  const isIndonesianMillion = currency === "IDR" && suffix.startsWith("juta");
  const isIndonesianThousand = currency === "IDR" && suffix.startsWith("ribu");
  if (isIndonesianMillion || isIndonesianThousand) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else {
    const commas = (raw.match(/,/g) ?? []).length;
    const dots = (raw.match(/\./g) ?? []).length;
    if (commas && dots) {
      const decimalMark = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
      raw = raw.replaceAll(decimalMark === "," ? "." : ",", "").replace(decimalMark, ".");
    } else if (commas || dots) {
      const mark = commas ? "," : ".";
      const count = commas || dots;
      const trailing = raw.length - raw.lastIndexOf(mark) - 1;
      const grouping = count > 1 || (trailing === 3 && !THREE_DECIMAL_CURRENCIES.has(currency));
      raw = grouping ? raw.replaceAll(mark, "") : raw.replace(mark, ".");
    }
  }
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (isIndonesianMillion) return amount * 1_000_000;
  if (isIndonesianThousand) return amount * 1_000;
  return amount;
}

const KNOWN_CURRENCY_CODES = new Set([
  ...Intl.supportedValuesOf("currency"),
  "AED", "AUD", "BGN", "BHD", "BRL", "CAD", "CHF", "CLP", "CNY", "COP", "CZK", "DKK", "EGP", "EUR", "GBP", "HKD", "HUF",
  "IDR", "ILS", "INR", "IQD", "ISK", "JOD", "JPY", "KES", "KRW", "KWD", "KZT", "LKR", "MAD", "MXN", "MYR", "NGN", "NOK",
  "NZD", "OMR", "PEN", "PHP", "PKR", "PLN", "QAR", "RON", "RSD", "RUB", "SAR", "SEK", "SGD", "THB", "TRY", "TWD", "TZS",
  "UAH", "USD", "VND", "ZAR",
]);

// 前缀顺序重要：复合符号（E£、R$、NT$）必须先于单字符符号匹配。
const CURRENCY_SYMBOLS: ReadonlyArray<readonly [string, string]> = [
  ["E£", "EGP"], ["R$", "BRL"], ["NT$", "TWD"], ["HK$", "HKD"], ["S$", "SGD"], ["A$", "AUD"], ["CA$", "CAD"], ["$CA", "CAD"],
  ["NZ$", "NZD"], ["MX$", "MXN"], ["US$", "USD"], ["₹", "INR"], ["₺", "TRY"], ["₦", "NGN"], ["₫", "VND"], ["đ", "VND"],
  ["₩", "KRW"], ["￦", "KRW"], ["£", "GBP"], ["€", "EUR"], ["Rp", "IDR"], ["₱", "PHP"], ["฿", "THB"], ["zł", "PLN"],
  ["Kč", "CZK"], ["Ft", "HUF"], ["CHF", "CHF"], ["₪", "ILS"], ["₸", "KZT"], ["₾", "GEL"], ["₴", "UAH"], ["₡", "CRC"],
  ["₲", "PYG"], ["₼", "AZN"], ["֏", "AMD"], ["лв", "BGN"], ["ден", "MKD"], ["дин", "RSD"],
];

/**
 * 从展示字符串识别币种。三字母 ISO 代码优先；仅有 $、¥、Rs、kr 等多义符号时返回 null，
 * 由调用方用商店目录的币种补足，并在两者冲突时拒绝入库。
 */
export function detectCurrencyFromDisplay(display: string): string | null {
  const text = display.replace(/[  ]/g, " ");
  const iso = text.match(/(?<![A-Z])([A-Z]{3})(?![A-Z])/);
  if (iso && KNOWN_CURRENCY_CODES.has(iso[1]!)) return iso[1]!;
  for (const [symbol, currency] of CURRENCY_SYMBOLS) {
    if (text.includes(symbol)) return currency;
  }
  if (/^R\s?[0-9]/.test(text.trim())) return "ZAR";
  return null;
}

export type AppStoreListingParser = "serialized_json" | "legacy_span" | "none";

export interface AppStoreListingParse {
  listings: AppStorePriceListing[];
  parser: AppStoreListingParser;
  storefront: string | null;
  annotationCount: number;
}

/**
 * 优先读取 Apple 页面内嵌的 `serialized-server-data` JSON：内购列表是 `$kind: "Annotation"`
 * 且 `items_V3` 含 `textPair` 的块，`leadingText` 为内购名，`trailingText` 为本币标价。
 * JSON 缺失时回退到相邻 span 解析并标明解析器。
 */
export function parseAppStoreListings(html: string, currency: string): AppStoreListingParse {
  const block = html.match(/<script[^>]*id="serialized-server-data"[^>]*>([\s\S]*?)<\/script>/i);
  if (block?.[1]) {
    try {
      const data = JSON.parse(block[1]) as unknown;
      const listings: AppStorePriceListing[] = [];
      let annotationCount = 0;
      const stack: unknown[] = [data];
      while (stack.length) {
        const node = stack.pop();
        if (Array.isArray(node)) {
          for (const item of node) stack.push(item);
          continue;
        }
        if (!node || typeof node !== "object") continue;
        const record = node as Record<string, unknown>;
        const items = record.items_V3;
        if (record.$kind === "Annotation" && Array.isArray(items)) {
          const pairs = items.filter((item): item is { leadingText: string; trailingText: string } =>
            Boolean(item) && typeof item === "object" && (item as Record<string, unknown>).$kind === "textPair"
            && typeof (item as Record<string, unknown>).leadingText === "string"
            && typeof (item as Record<string, unknown>).trailingText === "string");
          if (pairs.length) annotationCount += 1;
          for (const pair of pairs) {
            const rawPlanName = decodeInlineHtml(pair.leadingText);
            const displayAmount = decodeInlineHtml(pair.trailingText);
            if (!rawPlanName || !/[0-9]/.test(displayAmount)) continue;
            const amount = parseLocalizedAmount(displayAmount, currency);
            if (amount === null) continue;
            listings.push({ rawPlanName, displayAmount, amount });
          }
          continue;
        }
        for (const value of Object.values(record)) {
          if (value && typeof value === "object") stack.push(value);
        }
      }
      const storefront = block[1].match(/"storefront"\s*:\s*"([a-z]{2})"/)?.[1] ?? null;
      return { listings, parser: "serialized_json", storefront, annotationCount };
    } catch {
      // Malformed JSON: fall back to the legacy markup parser below.
    }
  }
  const listings = parseAppStorePriceListings(html, currency);
  return { listings, parser: listings.length ? "legacy_span" : "none", storefront: null, annotationCount: 0 };
}

/** 从 Apple 页面最终 URL 提取商店码；无效商店码会被 Apple 重定向到 us。 */
export function storefrontFromAppStoreUrl(url: string): string | null {
  return url.match(/^https:\/\/apps\.apple\.com\/([a-z]{2})(?:\/|$)/i)?.[1]?.toLowerCase() ?? null;
}

export interface AppStoreListingResolution {
  status: "selected" | "ambiguous_sku" | "sku_not_listed";
  listing: AppStorePriceListing | null;
  /** 同名候选项与同页哪些其他套餐金额相等，仅为线索。 */
  duplicateOf: string[];
  amounts: number[];
  /** 唯一金额可以选中，多金额始终保持歧义；历史推断标签仅为兼容。 */
  resolvedBy: "unique" | "duplicate_explained" | "vendor_monthly_amount" | null;
}

/** 保留同名多金额歧义，不用跨套餐或跨渠道金额相等推断 SKU 身份。 */
export function resolveAppStoreListing(
  listings: readonly AppStorePriceListing[],
  rawPlanName: string,
  options: { otherPlanNames?: readonly string[]; mustBeLessThanPlanName?: string; vendorMonthlyAmount?: number } = {},
): AppStoreListingResolution {
  const same = (left: string, right: string) => left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
  const matches = listings.filter((listing) => same(listing.rawPlanName, rawPlanName));
  if (!matches.length) return { status: "sku_not_listed", listing: null, duplicateOf: [], amounts: [], resolvedBy: null };
  const amounts = [...new Set(matches.map((listing) => listing.amount))];
  const otherNames = (options.otherPlanNames ?? []).filter((name) => !same(name, rawPlanName));
  const others = listings.filter((listing) => otherNames.some((name) => same(name, listing.rawPlanName)));
  const explained = new Map<number, string>();
  if (amounts.length > 1) {
    for (const amount of amounts) {
      const other = others.find((listing) => listing.amount === amount);
      if (other) explained.set(amount, other.rawPlanName);
    }
  }
  // Equal amounts across plans/channels are hints, never SKU or billing identity.
  const remaining = amounts;
  const duplicateOf = [...new Set(explained.values())];
  const resolvedBy = amounts.length === 1 ? "unique" as const : null;
  if (remaining.length !== 1) return { status: "ambiguous_sku", listing: null, duplicateOf, amounts, resolvedBy: null };
  const listing = matches.find((item) => item.amount === remaining[0]) ?? null;
  if (listing && options.mustBeLessThanPlanName) {
    const bound = listings
      .filter((item) => same(item.rawPlanName, options.mustBeLessThanPlanName!))
      .sort((left, right) => left.amount - right.amount)[0];
    if (bound && listing.amount >= bound.amount) return { status: "ambiguous_sku", listing: null, duplicateOf, amounts, resolvedBy: null };
  }
  return { status: listing ? "selected" : "ambiguous_sku", listing, duplicateOf, amounts, resolvedBy: listing ? resolvedBy : null };
}
