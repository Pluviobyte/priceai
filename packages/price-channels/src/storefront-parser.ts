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
  const compact = value.replace(/[\s\u00a0]/g, "");
  const match = compact.match(/[0-9][0-9.,]*/);
  if (!match) return null;

  let raw = match[0];
  const suffix = compact.slice((match.index ?? 0) + raw.length).toLowerCase();
  const isIndonesianMillion = currency === "IDR" && suffix.startsWith("juta");
  const isIndonesianThousand = currency === "IDR" && suffix.startsWith("ribu");

  if (isIndonesianMillion) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (currency === "IDR" && !isIndonesianThousand && /^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) {
    // Indonesian storefronts use periods for thousands, including a single
    // separator (Rp 14.500). Number("14.500") would silently divide it by 1,000.
    raw = raw.replaceAll(".", "").replace(",", ".");
  } else if (raw.includes(",") && raw.includes(".")) {
    const decimalMark = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? "," : ".";
    const thousandsMark = decimalMark === "," ? "." : ",";
    raw = raw.replaceAll(thousandsMark, "").replace(decimalMark, ".");
  } else if (raw.includes(",")) {
    const trailing = raw.length - raw.lastIndexOf(",") - 1;
    raw = trailing > 0 && trailing <= 2 ? raw.replace(",", ".") : raw.replaceAll(",", "");
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    const trailing = raw.length - raw.lastIndexOf(".") - 1;
    raw = trailing === 2 ? `${raw.slice(0, raw.lastIndexOf(".")).replaceAll(".", "")}.${raw.slice(raw.lastIndexOf(".") + 1)}` : raw.replaceAll(".", "");
  }

  const amount = Number(raw);
  if (!Number.isFinite(amount)) return null;
  if (isIndonesianMillion) return amount * 1_000_000;
  if (isIndonesianThousand) return amount * 1_000;
  return amount;
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
