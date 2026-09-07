import assert from "node:assert/strict";
import test from "node:test";
import {
  detectCurrencyFromDisplay,
  parseAppStoreListings,
  parseLocalizedAmount,
  resolveAppStoreListing,
  storefrontFromAppStoreUrl,
} from "./storefront-parser.js";
import { parseGeminiSubscriptionPage, parseGooglePlayInAppRange, parseOpenAiCheckoutConfig } from "./vendor-page-parsers.js";

test("parses localized amounts by currency conventions", () => {
  const cases: Array<[string, string, number]> = [
    ["$19.99", "USD", 19.99], ["USD 200.00", "USD", 200], ["₹ 1,999", "INR", 1999], ["Rs 1,400.00", "PKR", 1400],
    ["₺999,99", "TRY", 999.99], ["₺5.299,99", "TRY", 5299.99], ["22,99 €", "EUR", 22.99], ["R$ 779,9", "BRL", 779.9],
    ["R$ 1.499,90", "BRL", 1499.9], ["¥3,000", "JPY", 3000], ["￦29,000", "KRW", 29000], ["132.000đ", "VND", 132000],
    ["Rp 14.500", "IDR", 14500], ["Rp 1.579.000", "IDR", 1579000], ["Rp 349ribu", "IDR", 349000], ["Rp 3,499juta", "IDR", 3499000],
    ["NT$ 3300", "TWD", 3300], ["MXN 1,999", "MXN", 1999], ["EGP 9,999.99", "EGP", 9999.99], ["R399.99", "ZAR", 399.99],
    ["S$ 29.98", "SGD", 29.98], ["8 990 Ft", "HUF", 8990], ["1 499,90 €", "EUR", 1499.9], ["KWD 6.500", "KWD", 6.5],
    ["zł 23,99", "PLN", 23.99], ["179 kr", "DKK", 179], ["₦ 31,500.00", "NGN", 31500],
  ];
  for (const [display, currency, expected] of cases) {
    assert.equal(parseLocalizedAmount(display, currency), expected, `${display} (${currency})`);
  }
  assert.equal(parseLocalizedAmount("Free", "USD"), null);
});

test("detects currencies from ISO codes and unambiguous symbols only", () => {
  assert.equal(detectCurrencyFromDisplay("USD 19.99"), "USD");
  assert.equal(detectCurrencyFromDisplay("EGP 249.99"), "EGP");
  assert.equal(detectCurrencyFromDisplay("₹ 399"), "INR");
  assert.equal(detectCurrencyFromDisplay("R$ 99,90"), "BRL");
  assert.equal(detectCurrencyFromDisplay("NT$ 650"), "TWD");
  assert.equal(detectCurrencyFromDisplay("6.99 $CA/month"), "CAD");
  assert.equal(detectCurrencyFromDisplay("R399.99"), "ZAR");
  assert.equal(detectCurrencyFromDisplay("$399.00"), null);
  assert.equal(detectCurrencyFromDisplay("Rs 4,900.00"), null);
  assert.equal(detectCurrencyFromDisplay("¥3,000"), null);
  assert.equal(detectCurrencyFromDisplay("179 kr"), null);
});

const serializedPage = (pairs: Array<[string, string]>, storefront = "jp") => `<html><head><script type="application/json" id="serialized-server-data">${JSON.stringify([{
  intent: { storefront },
  data: {
    sections: [
      { $kind: "Annotation", title: "Seller", summary: null, items_V3: [{ $kind: "text", text: "Anthropic PBC" }] },
      { $kind: "Annotation", title: "アプリ内購入", summary: "あり", items_V3: [
        ...pairs.map(([leadingText, trailingText]) => ({ $kind: "textPair", leadingText, trailingText })),
        { $kind: "button", action: { title: "詳しい情報" } },
      ] },
    ],
  },
}])}</script></head><body><span>Claude Pro - Monthly</span><span>¥1</span></body></html>`;

test("reads App Store in-app purchases from the serialized JSON block before the legacy markup", () => {
  const html = serializedPage([["Claude Pro - Monthly", "¥3,000"], ["Claude Max 5x - Monthly", "¥20,000"], ["Claude Pro - Annual", "¥35,000"]]);
  const parsed = parseAppStoreListings(html, "JPY");
  assert.equal(parsed.parser, "serialized_json");
  assert.equal(parsed.storefront, "jp");
  assert.equal(parsed.annotationCount, 1);
  assert.deepEqual(parsed.listings.map((listing) => [listing.rawPlanName, listing.amount]), [["Claude Pro - Monthly", 3000], ["Claude Max 5x - Monthly", 20000], ["Claude Pro - Annual", 35000]]);
});

test("falls back to the legacy span parser and reports when nothing parses", () => {
  const legacy = parseAppStoreListings("<div><span>ChatGPT Go</span> <span>₹ 399</span></div>", "INR");
  assert.equal(legacy.parser, "legacy_span");
  assert.equal(legacy.listings[0]?.amount, 399);
  assert.equal(parseAppStoreListings("<html><body>Nothing here</body></html>", "USD").parser, "none");
});

test("reads the storefront from the final App Store URL so redirects to us are detected", () => {
  assert.equal(storefrontFromAppStoreUrl("https://apps.apple.com/us/app/chatgpt/id6448311069"), "us");
  assert.equal(storefrontFromAppStoreUrl("https://apps.apple.com/tr/app/id6448311069"), "tr");
  assert.equal(storefrontFromAppStoreUrl("https://apps.apple.com/story/id123"), null);
});

test("matching another plan amount does not resolve a possibly annual or promotional SKU", () => {
  const listings = [
    { rawPlanName: "ChatGPT Plus", displayAmount: "$19.99", amount: 19.99 },
    { rawPlanName: "ChatGPT Go", displayAmount: "$8.00", amount: 8 },
    { rawPlanName: "ChatGPT Pro 5x", displayAmount: "$100.00", amount: 100 },
    { rawPlanName: "ChatGPT Pro 20x", displayAmount: "$200.00", amount: 200 },
    { rawPlanName: "ChatGPT Plus", displayAmount: "$200.00", amount: 200 },
  ];
  const known = ["ChatGPT Go", "ChatGPT Plus", "ChatGPT Pro 5x", "ChatGPT Pro 20x"];
  const plus = resolveAppStoreListing(listings, "ChatGPT Plus", { otherPlanNames: known, mustBeLessThanPlanName: "ChatGPT Pro 5x" });
  assert.equal(plus.status, "ambiguous_sku");
  assert.equal(plus.listing, null);
  assert.deepEqual(plus.duplicateOf, ["ChatGPT Pro 20x"]);
  assert.equal(plus.resolvedBy, null);
  assert.deepEqual(plus.amounts, [19.99, 200]);
  assert.equal(resolveAppStoreListing(listings, "ChatGPT Pro 20x", { otherPlanNames: known }).listing?.amount, 200);
  assert.equal(resolveAppStoreListing(listings, "ChatGPT Team", { otherPlanNames: known }).status, "sku_not_listed");
});

test("unexplained duplicate amounts stay ambiguous and never pick the cheapest", () => {
  const listings = [
    { rawPlanName: "SuperGrok", displayAmount: "$30.00", amount: 30 },
    { rawPlanName: "SuperGrok", displayAmount: "$300.00", amount: 300 },
    { rawPlanName: "SuperGrok Plus", displayAmount: "$100.00", amount: 100 },
  ];
  const resolution = resolveAppStoreListing(listings, "SuperGrok", { otherPlanNames: ["SuperGrok", "SuperGrok Plus"] });
  assert.equal(resolution.status, "ambiguous_sku");
  assert.equal(resolution.listing, null);
  assert.deepEqual(resolution.amounts, [30, 300]);
  // The vendor's same-country web page can single out the monthly amount among duplicates.
  const google = [{ rawPlanName: "Google AI Plus (400 GB)", displayAmount: "$4.99", amount: 4.99 }, { rawPlanName: "Google AI Plus (400 GB)", displayAmount: "$49.99", amount: 49.99 }];
  const byWeb = resolveAppStoreListing(google, "Google AI Plus (400 GB)", { vendorMonthlyAmount: 4.99 });
  assert.equal(byWeb.status, "ambiguous_sku");
  assert.equal(byWeb.listing, null);
  assert.equal(byWeb.resolvedBy, null);
  assert.equal(resolveAppStoreListing(google, "Google AI Plus (400 GB)", { vendorMonthlyAmount: 5 }).status, "ambiguous_sku");
  assert.equal(resolveAppStoreListing(google.slice(0, 1), "Google AI Plus (400 GB)", {}).resolvedBy, "unique");
  // A plan whose remaining amount is not below the required upper bound is also ambiguous.
  const bounded = resolveAppStoreListing([{ rawPlanName: "ChatGPT Plus", displayAmount: "$200", amount: 200 }, { rawPlanName: "ChatGPT Pro 5x", displayAmount: "$100", amount: 100 }], "ChatGPT Plus", { otherPlanNames: ["ChatGPT Pro 5x"], mustBeLessThanPlanName: "ChatGPT Pro 5x" });
  assert.equal(bounded.status, "ambiguous_sku");
});

test("Google Play pages only expose an in-app purchase range", () => {
  const raw = '...,[2],["₹399.00 - ₹19,900.00 per item",[0]],null...';
  assert.deepEqual(parseGooglePlayInAppRange(raw, "INR"), { lowerText: "₹399.00", upperText: "₹19,900.00", lower: 399, upper: 19900, currency: "INR" });
  const escaped = '["\\u20b9399.00 - \\u20b919,900.00 per item",[0]]';
  assert.equal(parseGooglePlayInAppRange(escaped, "INR")?.upper, 19900);
  const dollars = parseGooglePlayInAppRange('["$7.99 - $199.99 per item",[0]]', "USD");
  assert.equal(dollars?.currency, "USD");
  assert.equal(dollars?.lower, 7.99);
  assert.equal(parseGooglePlayInAppRange("<html>no purchases</html>"), null);
});

function geminiCard(name: string, title: string, subtitle = ""): string {
  return `<div class="_card_1v1dw_1"><div class="_cardLogoText_1v1dw_142 _size:headline-2">${name}</div><div class="_cardPricing_1v1dw_359"><div class="_cardPricingEyebrow_1v1dw_380">Starting at:</div><div class="_cardPricingTitle_1v1dw_366">${title}</div><div class="_cardPricingSubtitle_1v1dw_417">${subtitle}</div></div></div>`;
}

test("parses Google AI plan cards from the country subscriptions page", () => {
  const html = `<html><head><link rel="canonical" href="https://gemini.google/in/subscriptions/?hl=en-IN"></head><body>
    ${geminiCard("Google AI Plus <sup>1</sup>", '<span class="price"><span class="price-symbol">₹</span><span class="price-amount">399</span></span> INR/month')}
    ${geminiCard("Google AI Pro", '<span class="price"><span class="price-symbol">₹</span><span class="price-amount">1,950</span></span> INR/month')}
    ${geminiCard("Google AI Ultra", '<span class="price"><span class="price-symbol">₹</span><span class="price-amount">6,500</span></span> INR/month', '<span class="price"><span class="price-amount">6,500</span></span> INR/month: 5x higher usage limits vs. AI Pro <span class="price"><span class="price-amount">19,500</span></span> INR /month: 20x higher usage limits vs AI Pro')}
    ${geminiCard("Gemini Enterprise", '<span class="price"><span class="price-amount">$30</span></span> USD per seat per month')}
  </body></html>`;
  const parsed = parseGeminiSubscriptionPage(html, "INR");
  assert.equal(parsed.canonicalCountry, "IN");
  assert.equal(parsed.cardCount, 3);
  assert.deepEqual(parsed.plans.map((plan) => [plan.planKey, plan.amount, plan.currency, plan.periodConfirmed]), [
    ["plus", 399, "INR", true], ["pro", 1950, "INR", true], ["ultra_5x", 6500, "INR", true], ["ultra_20x", 19500, "INR", true],
  ]);
});

test("Google AI cards without an amount, localized period words and the US default page are handled", () => {
  const korean = `<link rel="canonical" href="https://gemini.google/kr/subscriptions/">${geminiCard("Google AI Pro", "")}${geminiCard("Google AI Plus", '매월 <span class="price"><span class="price-symbol">₩</span><span class="price-amount">7,500</span></span> KRW')}`;
  const parsed = parseGeminiSubscriptionPage(korean, "KRW");
  assert.equal(parsed.canonicalCountry, "KR");
  assert.equal(parsed.plans.find((plan) => plan.planKey === "pro")?.amountText, "");
  assert.deepEqual(parsed.plans.find((plan) => plan.planKey === "plus")?.amount, 7500);
  assert.equal(parsed.plans.find((plan) => plan.planKey === "plus")?.periodConfirmed, true);
  const german = parseGeminiSubscriptionPage(geminiCard("Google AI Plus", '<span class="price"><span class="price-symbol">€</span><span class="price-amount">4,99</span></span> EUR/Monat'), "EUR");
  assert.deepEqual([german.plans[0]?.amount, german.plans[0]?.currency, german.plans[0]?.periodConfirmed], [4.99, "EUR", true]);
  const us = parseGeminiSubscriptionPage(`<link rel="canonical" href="https://gemini.google/subscriptions/">${geminiCard("Google AI Pro", '<span class="price"><span class="price-amount">$19.99</span></span>/ month')}`, "USD");
  assert.equal(us.canonicalCountry, "US");
  assert.equal(us.plans[0]?.amount, 19.99);
  const yearly = parseGeminiSubscriptionPage(geminiCard("Google AI Pro", '<span class="price"><span class="price-amount">$199</span></span> / year'), "USD");
  assert.equal(yearly.plans[0]?.periodConfirmed, false);
  // Right-to-left storefronts (AE/EG/SA use Arabic, PK uses Urdu) keep the ISO code and a "per month" phrase.
  const arabic = parseGeminiSubscriptionPage(geminiCard("Google AI Plus 1", '\u202b\u200e د.إ. \u200f<span class="price"><span class="price-amount">18.99</span></span> \u200f AED في الشهر'));
  assert.deepEqual([arabic.plans[0]?.amount, arabic.plans[0]?.currency, arabic.plans[0]?.periodConfirmed], [18.99, "AED", true]);
  const urdu = parseGeminiSubscriptionPage(geminiCard("Google AI Plus", '\u202b Rs <span class="price"><span class="price-amount">1,400</span></span> PKR فی ماہ'));
  assert.deepEqual([urdu.plans[0]?.amount, urdu.plans[0]?.currency, urdu.plans[0]?.periodConfirmed], [1400, "PKR", true]);
  // European storefronts served in their own language (observed 2026-09-08).
  for (const wording of ["4,99 €/месец", "149,99 Kč měsíčně", "kr. 40 DKK/md.", "€ 4,99 EUR kuus", "€ 4,99 EUR kuukaudessa", "€ 4,99 EUR/μήνα", "€ 4,99 EUR mjesečno", "1890 HUF/hó", "€ 4,99 EUR / mėn.", "€ 4,99 EUR / mēnesī", "kr 64 NOK per måned", "RON 26,99 /lună", "RSD 649 месечно", "€ 4,99 EUR mesačne", "₴ 224,99 UAH на місяць", "€ 99,99 EUR per maand", "kr. 799 DKK pr. måned", "₴ 4 599 UAH/міс."]) {
    const page = parseGeminiSubscriptionPage(geminiCard("Google AI Plus", wording.replace(/([0-9][0-9.,]*)/, '<span class="price"><span class="price-amount">$1</span></span>')));
    assert.equal(page.plans[0]?.periodConfirmed, true, wording);
    assert.ok(page.plans[0]?.currency, wording);
  }
});

test("maps the OpenAI checkout config to catalog plans with tax and rollout evidence", () => {
  const india = JSON.stringify({ country_code: "IN", currency_config: {
    free: { month: { tax: "inclusive", amount: 0 } },
    go: { month: { amount: 399, tax: "inclusive" } },
    plus: { month: { amount: 1999, tax: "inclusive", psp_override: { amount: 1694.07, tax: "exclusive" } }, year: { amount: 1665.83, tax: "inclusive" } },
    prolite: { month: { amount: 10699, tax: "inclusive" } },
    pro: { month: { amount: 19900, tax: "inclusive" } },
    business: { month: { amount: 2250, tax: "exclusive" }, year: { amount: 1800, tax: "exclusive" } },
    symbol_code: "INR", tax_type: "gst", tax_percent: 18, promos: { plus_intro_offer_3m: { enabled: true } }, mystery_plan: { month: { amount: 1 } },
  } });
  const parsed = parseOpenAiCheckoutConfig(india);
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.countryCode, "IN");
  assert.equal(parsed.currency, "INR");
  assert.equal(parsed.taxType, "gst");
  assert.equal(parsed.taxPercent, 18);
  assert.equal(parsed.rolloutGate, null);
  assert.deepEqual(parsed.prices.map((price) => [price.planCode, price.amount, price.tax]), [
    ["chatgpt-go-monthly", 399, "inclusive"], ["chatgpt-plus-monthly", 1999, "inclusive"], ["chatgpt-pro-5x-monthly", 10699, "inclusive"], ["chatgpt-pro-20x-monthly", 19900, "inclusive"],
  ]);
  assert.deepEqual(parsed.prices[1]?.pspOverride, { amount: 1694.07, tax: "exclusive" });
  assert.deepEqual(parsed.plusAnnualMonthlyEquivalent, { amount: 1665.83, tax: "inclusive" });
  assert.deepEqual(parsed.unknownKeys, ["mystery_plan"]);
  const gated = parseOpenAiCheckoutConfig(JSON.stringify({ country_code: "BR", currency_config: { plus: { month: { amount: 99.9, tax: "exclusive" } }, symbol_code: "BRL", pricing_rollout_gate: "is_pricing_enabled_for_brl" } }));
  assert.equal(gated.rolloutGate, "is_pricing_enabled_for_brl");
  assert.equal(parseOpenAiCheckoutConfig('{"detail":"Country config not found"}').status, "not_found");
  assert.equal(parseOpenAiCheckoutConfig("<html>Just a moment...</html>").status, "invalid");
});

 test("null, empty, boolean and zero OpenAI amounts never become free paid plans", () => {
  for (const amount of [null, "", " ", false, true, 0, -1]) {
    const parsed = parseOpenAiCheckoutConfig(JSON.stringify({country_code:"US",currency_config:{symbol_code:"USD",plus:{month:{amount}}}}));
    assert.equal(parsed.prices.length, 0);
  }
});

test("Ultra tiers are associated with explicit labels even if their order reverses", () => {
  const html=geminiCard("Google AI Ultra", '<span class="price-amount">$99</span>/month', '<span class="price"><span class="price-amount">$199</span></span>/month: 20x usage <span class="price"><span class="price-amount">$99</span></span>/month: 5x usage');
  const parsed=parseGeminiSubscriptionPage(html,"USD");
  assert.equal(parsed.plans.find(p=>p.planKey==='ultra_5x')?.amount,99);
  assert.equal(parsed.plans.find(p=>p.planKey==='ultra_20x')?.amount,199);
  assert.equal(parseGeminiSubscriptionPage(geminiCard("Google AI Ultra",'<span class="price-amount">$99</span>/month'),"USD").plans.length,0);
});

test("localized Ultra usage labels retain their own price and monthly period", () => {
  const labels = [
    ["5‑mal", "20‑mal"], ["cinq fois", "20 fois"], ["5 veces", "20 veces"],
    ["5배", "20배"], ["5 kat", "20 kat"], ["5 مرات", "20 مرة"],
    ["5 razy", "20 razy"], ["5 volte", "20 volte"], ["5 пъти", "20 пъти"],
    ["5 kertaa", "20 kertaa"], ["5 φορές", "20 φορές"], ["5 puta", "20 puta"],
    ["Ötször", "20-szor"], ["פי 5", "פי 20"], ["penkis kartus", "dvidešimt kartų"],
    ["piecas reizes", "20 reizes"], ["5 ganger", "20 ganger"], ["5 گنا", "20 گنا"],
    ["5 vezes", "20 vezes"], ["cinci ori", "20 de ori"], ["5 пута", "20 пута"],
    ["fem gånger", "20 gånger"], ["5-krat", "20-krat"], ["5-krát", "20‑krát"],
    ["5 เท่า", "20 เท่า"], ["5 разів", "20 разів"], ["5 lần", "20 lần"],
  ];
  for (const [five, twenty] of labels) {
    const subtitle = `<span class="price"><span class="price-amount">219.99</span></span> EUR/month: ${twenty} AI Pro <span class="price"><span class="price-amount">99.99</span></span> EUR/month: ${five} AI Pro`;
    const parsed = parseGeminiSubscriptionPage(geminiCard("Google AI Ultra", "", subtitle));
    assert.deepEqual(parsed.plans.map(p => [p.planKey, p.amount, p.periodConfirmed]), [["ultra_20x",219.99,true],["ultra_5x",99.99,true]], five ?? "unknown label");
  }
  const chinese = '每月 <span class="price"><span class="price-amount">3300</span></span> NT$：用量上限是 AI Pro 的 5 倍 每月 <span class="price"><span class="price-amount">6500</span></span> NT$：用量上限是 AI Pro 的 20 倍';
  assert.deepEqual(parseGeminiSubscriptionPage(geminiCard("Google AI Ultra", "", chinese)).plans.map(p=>p.periodConfirmed), [true,true]);
});

test("Google local ISO currencies override Apple storefront USD fallback and anomalous USD requires review", () => {
  for (const code of ["BOB", "CRC", "DZD", "GEL", "GHS", "PYG"]) {
    const price = parseGeminiSubscriptionPage(geminiCard("Google AI Plus", `<span class="price"><span class="price-amount">3100</span></span> ${code}/month`), "USD").plans[0]!;
    assert.equal(price.currency, code);
    assert.equal(price.requiresPriceReview, false);
  }
  const sourceError = parseGeminiSubscriptionPage(geminiCard("Google AI Plus", '<span class="price"><span class="price-amount">3,100</span></span> USD/month'), "USD").plans[0]!;
  assert.equal(sourceError.currency, "USD");
  assert.equal(sourceError.amount, 3100);
  assert.equal(sourceError.requiresPriceReview, true);
});
