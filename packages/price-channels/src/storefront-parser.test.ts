import assert from "node:assert/strict";
import test from "node:test";
import { extractChatGptGoWebPrice, extractOfficialPagePrice, officialPageConfirmsPrice, parseAppStorePriceListings, selectAppStorePlanPrice } from "./storefront-parser.js";

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

test("Go web price is scoped to the tier and explicit USD monthly billing", () => {
  assert.equal(extractChatGptGoWebPrice("<h3>Go</h3><p>Expanded access</p><b>$8 USD / month</b><h3>Plus</h3><p>$20 USD / month</p>"), 8);
  assert.equal(extractChatGptGoWebPrice("Go Expanded access / month Plus $20 USD / month"), null);
  assert.equal(extractChatGptGoWebPrice("Go Expanded access A$13 / month Plus $20 USD / month"), null);
  assert.equal(extractChatGptGoWebPrice("Go Expanded access $8 USD / year Plus $20 USD / month"), null);
  assert.equal(extractChatGptGoWebPrice("Access denied"), null);
});
