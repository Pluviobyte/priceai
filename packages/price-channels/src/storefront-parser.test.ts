import assert from "node:assert/strict";
import test from "node:test";
import { extractChatGptGoWebPrice, extractClaudePlanPrice, hasAmbiguousAppStorePrices, extractOfficialPagePrice, officialPageConfirmsPrice, parseAppStorePriceListings, selectAppStorePlanPrice } from "./storefront-parser.js";

test("parses common App Store currency formats", () => {
  const html = `
    <span>ChatGPT Plus</span><span>₹ 1,999</span>
    <span>Claude Pro - Monthly</span><span>₺999,99</span>
    <span>Claude Max 20x - Monthly</span><span>R$ 1.499,90</span>
  `;

  assert.deepEqual(parseAppStorePriceListings(html, "INR")[0], {
    rawPlanName: "ChatGPT Plus",
    displayAmount: "₹ 1,999",
    amount: 1999,
  });
  assert.equal(parseAppStorePriceListings(html, "TRY")[1]?.amount, 999.99);
  assert.equal(parseAppStorePriceListings(html, "BRL")[2]?.amount, 1499.9);
});

test("parses Indonesian thousand and million suffixes", () => {
  const html = `
    <span>ChatGPT Plus</span><span>Rp 349ribu</span>
    <span>ChatGPT Pro 20x</span><span>Rp 3,499juta</span>
  `;
  const prices = parseAppStorePriceListings(html, "IDR");

  assert.equal(prices[0]?.amount, 349_000);
  assert.equal(prices[1]?.amount, 3_499_000);
});

test("parses Indonesian period grouping without changing abbreviated prices", () => {
  const prices = parseAppStorePriceListings(`
    <span>Google AI Plus (400 GB)</span><span>Rp 14.500</span>
    <span>Google AI Pro (5 TB)</span><span>Rp 1.500.000</span>
    <span>ChatGPT Go</span><span>Rp 14,5ribu</span>
    <span>ChatGPT Pro 20x</span><span>Rp 3,499juta</span>
  `, "IDR");
  assert.deepEqual(prices.map(price => price.amount), [14_500, 1_500_000, 14_500, 3_499_000]);
});

test("selects the monthly ChatGPT Plus price when annual and monthly labels repeat", () => {
  const html = `
    <span>ChatGPT Plus</span><span>$200.00</span>
    <span>ChatGPT Plus</span><span>$19.99</span>
  `;
  const prices = parseAppStorePriceListings(html, "USD");

  assert.equal(selectAppStorePlanPrice(prices, "ChatGPT Plus", "lowest")?.amount, 19.99);
});

test("does not mistake an annual ChatGPT Plus listing for a monthly price", () => {
  const html = `
    <span>ChatGPT Plus</span><span>$200.00</span>
    <span>ChatGPT Pro 5x</span><span>$100.00</span>
  `;
  const prices = parseAppStorePriceListings(html, "USD");

  assert.equal(selectAppStorePlanPrice(prices, "ChatGPT Plus", "lowest", { mustBeLessThanPlanName: "ChatGPT Pro 5x" }), null);
});

test("decodes non-breaking spaces and HTML entities", () => {
  const html = `<span>Claude Pro - Monthly</span><span>S$&nbsp;29.98</span>`;
  const [price] = parseAppStorePriceListings(html, "SGD");

  assert.equal(price?.displayAmount, "S$ 29.98");
  assert.equal(price?.amount, 29.98);
});

test("only confirms a known web price when plan terms and dollar amount are present", () => {
  const html = `<main><h2>Claude Max 5x</h2><p>US$100 per month</p><script>const decoy = "$200"</script></main>`;

  assert.equal(officialPageConfirmsPrice(html, ["Claude Max", "5x"], 100), true);
  assert.equal(officialPageConfirmsPrice(html, ["Claude Max", "20x"], 100), false);
  assert.equal(officialPageConfirmsPrice(html, ["Claude Max", "5x"], 200), false);
});

test("extracts the amount nearest the named plan instead of an unrelated page price", () => {
  const html = `<p>Another plan costs $100</p><section><h2>Claude Max 5x</h2><p>Now US$120 per month</p></section>`;

  assert.equal(extractOfficialPagePrice(html, ["Claude Max 5x"]), 120);
});

test("xAI monthly cards use the complete plan name and never borrow a neighboring price", () => {
  // Current headings and prices from https://x.ai/pricing, reviewed 2026-09-07.
  const html = '<h3>Free</h3><p>$0/month</p><h3>SuperGrok</h3><p>$30/month</p><h3>SuperGrok Plus</h3><p>$100/month</p>';
  assert.equal(extractOfficialPagePrice(html, ["SuperGrok"]), 30);
  assert.equal(extractOfficialPagePrice(html, ["SuperGrok Plus"]), 100);
  assert.equal(extractOfficialPagePrice('<h3>SuperGrok</h3><p>Pricing unavailable</p><h3>SuperGrok Plus</h3><p>$100/month</p>', ["SuperGrok"]), null);
  assert.equal(extractOfficialPagePrice('<h3>SuperGrok Plus</h3><p>$100/month</p>', ["SuperGrok"]), null);
  assert.equal(extractOfficialPagePrice('<h3>SuperGrok Heavy</h3><p>$300/month</p>', ["SuperGrok"]), null);
});

test("xAI monthly cards reject annual, unspecified, localized or ambiguous amounts", () => {
  for (const price of ['$300/year', '$30', '$25/month, billed annually', 'A$45/month', '$20/month or $30/month']) {
    assert.equal(extractOfficialPagePrice(`<h3>SuperGrok</h3><p>${price}</p>`, ["SuperGrok"]), null);
  }
  assert.equal(extractOfficialPagePrice('<h3>SuperGrok</h3><p>USD 30 per month</p>', ["SuperGrok"]), 30);
});

test("OpenAI tier prose cannot assign the first Pro price to both tiers", () => {
  // Official Help Center, reviewed 2026-09-07:
  // https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro
  // The article identifies the two amounts, but this fragment does not establish a billing period.
  const html = '<h1>ChatGPT Pro</h1><p>Pro $100 unlocks 5x higher usage than Plus, while Pro $200 unlocks 20x usage than Plus.</p>';
  assert.equal(extractOfficialPagePrice(html, ["ChatGPT Pro", "5x"]), null);
  assert.equal(extractOfficialPagePrice(html, ["ChatGPT Pro", "20x"]), null);
});

test("OpenAI monthly prices bind the amount to the named Pro tier", () => {
  const html = '<h1>ChatGPT Pro</h1><p>Pro $100 per month provides 5x usage; Pro $200 per month provides 20x usage.</p>';
  assert.equal(extractOfficialPagePrice(html, ["ChatGPT Pro", "5x"]), 100);
  assert.equal(extractOfficialPagePrice(html, ["ChatGPT Pro", "20x"]), 200);
  assert.equal(extractOfficialPagePrice('<h1>ChatGPT Pro 20x</h1><p>USD 200 / month</p>', ["ChatGPT Pro", "20x"]), 200);
});

test("OpenAI monthly prices reject another tier, another currency, annual billing and conflicting amounts", () => {
  assert.equal(extractOfficialPagePrice('<p>ChatGPT Plus is $20/month, billed annually.</p>', ["ChatGPT Plus"]), null);
  assert.equal(extractOfficialPagePrice('<p>ChatGPT Pro 20x is $200/month, billed annually.</p>', ["ChatGPT Pro", "20x"]), null);
  assert.equal(extractOfficialPagePrice('<h1>ChatGPT Pro</h1><p>Pro $100/month provides 5x usage. Pro $200/year provides 20x usage.</p>', ["ChatGPT Pro", "20x"]), null);
  assert.equal(extractOfficialPagePrice('<h1>ChatGPT Pro 20x</h1><p>A$300/month</p>', ["ChatGPT Pro", "20x"]), null);
  assert.equal(extractOfficialPagePrice('<h1>ChatGPT Pro 20x</h1><h2>ChatGPT Pro 5x</h2><p>$100/month</p>', ["ChatGPT Pro", "20x"]), null);
  assert.equal(extractOfficialPagePrice('<h1>ChatGPT Plus</h1><p>ChatGPT Pro $100/month</p>', ["ChatGPT Plus"]), null);
  assert.equal(extractOfficialPagePrice('<p>ChatGPT Plus is $20/month.</p><p>ChatGPT Plus is $25/month.</p>', ["ChatGPT Plus"]), null);
  assert.equal(extractOfficialPagePrice('<p>ChatGPT Plus is $20/month or $25/month depending on eligibility.</p>', ["ChatGPT Plus"]), null);
  assert.equal(extractOfficialPagePrice('<p>ChatGPT Pro has 5x and 20x tiers for $100/month and $200/month.</p>', ["ChatGPT Pro", "20x"]), null);
  assert.equal(extractOfficialPagePrice('<p>ChatGPT Plus is $20/month.</p><p>ChatGPT Pro is $100/month.</p>', ["ChatGPT Plus"]), 20);
});

test("Go web price is scoped to the tier and explicit USD monthly billing", () => {
  assert.equal(extractChatGptGoWebPrice("<h3>Go</h3><p>Expanded access</p><b>$8 USD / month</b><h3>Plus</h3><p>$20 USD / month</p>"), 8);
  assert.equal(extractChatGptGoWebPrice("Go Expanded access / month Plus $20 USD / month"), null);
  assert.equal(extractChatGptGoWebPrice("Go Expanded access A$13 / month Plus $20 USD / month"), null);
  assert.equal(extractChatGptGoWebPrice("Go Expanded access $8 USD / year Plus $20 USD / month"), null);
  assert.equal(extractChatGptGoWebPrice("Access denied"), null);
});

test("does not swallow the first IAP item after unrelated page spans", () => {
  const html = '<span>Information</span><section><span>In-App Purchases</span></section><div><span>ChatGPT Go</span> <span>₹ 399</span></div><div><span>ChatGPT Plus</span><span>₹ 1,999</span></div>';
  assert.deepEqual(parseAppStorePriceListings(html, "INR").map(row => row.amount), [399, 1999]);
});

test("Claude table parser separates annual, monthly and Max prices", () => {
  // The official plan guide has a separate Billing Interval column for Max.
  const html = '<table><tr><th>Plan</th><th>Price</th><th>Billing Interval</th></tr><tr><td>Pro</td><td><p>$20/month</p><p>$200/year</p></td><td>Monthly or annual</td></tr><tr><td>Max 5x</td><td>$100</td><td>Monthly</td></tr><tr><td>Max 20x</td><td>$200</td><td>Monthly</td></tr></table>';
  assert.equal(extractClaudePlanPrice(html, "claude-pro-monthly"), 20);
  assert.equal(extractClaudePlanPrice(html, "claude-pro-annual"), 200);
  assert.equal(extractClaudePlanPrice(html, "claude-max-5x-monthly"), 100);
  assert.equal(extractClaudePlanPrice(html, "claude-max-20x-monthly"), 200);
  assert.equal(extractClaudePlanPrice('<table><tr><td>Pro</td><td>$20/month</td></tr></table>', "claude-pro-annual"), null);
});

test("Claude Max rejects an annual, localized or unspecified price as a USD month fee", () => {
  for (const price of ['$100 / year', 'A$150/month', '$100', '$100/month, billed annually']) {
    assert.equal(extractClaudePlanPrice(`<tr><td>Max 5x</td><td>${price}</td></tr>`, "claude-max-5x-monthly"), null);
  }
  assert.equal(extractClaudePlanPrice('<tr><td>Max 20x</td><td>USD 200/month</td></tr>', "claude-max-20x-monthly"), 200);
  assert.equal(extractClaudePlanPrice('<tr><td>Pro</td><td>A$30/month</td></tr>', "claude-pro-monthly"), null);
});

test("multiple distinct prices require review; repeated identical prices do not", () => {
  const rows = [{rawPlanName: "Plan", amount: 10, displayAmount: "$10"}, {rawPlanName: "Plan", amount: 100, displayAmount: "$100"}];
  assert.equal(hasAmbiguousAppStorePrices(rows, "plan"), true);
  assert.equal(hasAmbiguousAppStorePrices([rows[0]!, rows[0]!], "Plan"), false);
  assert.equal(hasAmbiguousAppStorePrices(rows, "Other"), false);
});
