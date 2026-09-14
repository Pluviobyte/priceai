import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { APPLE_STOREFRONT_CATALOG } from "@price-radar/price-channels/storefront-catalog";
import type { OfficialSubscriptionPrice, OfficialSubscriptionCheck } from "./public-pricing";
const checks: OfficialSubscriptionCheck[] = APPLE_STOREFRONT_CATALOG.map(region => ({
  vendor: "openai", planCode: "chatgpt-plus-monthly", channel: "web", countryCode: region.countryCode,
  status: "fetch_failed", reason: "Test fixture", evidenceUrl: "https://example.com", checkedAt: new Date(), evidence: {},
}));

// Node does not render CSS; keep the real server component and its data logic.
const requireForTest = createRequire(__filename);
requireForTest.extensions[".css"] = module => { module.exports = {}; };
const render = async (params: Record<string, string> = {}, rows: OfficialSubscriptionPrice[] = []) => {
  const { PriceComparison } = await import("../app/official-prices/price-comparison");
  return renderToStaticMarkup(createElement(PriceComparison, { rows, checks, params, available: true }));
};

test("official comparison bounds initial HTML and cells even when all regions are selected", async () => {
  const html = await render();
  assert.ok((html.match(/<td/g) ?? []).length <= 120, "render at most 12 combinations and 10 regions");
  assert.ok(Buffer.byteLength(html) < 1_000_000, "empty matrix must stay under 1 MB");
  assert.match(html, /下一组地区/);
});

test("region pagination preserves filters and explicit region stays directly accessible", async () => {
  const html = await render({ compare_page: "2", compare_vendor: "openai", compare_basis: "month", q: "Plus" });
  assert.match(html, /上一组地区/);
  assert.match(html, /compare_vendor=openai/);
  assert.match(html, /compare_basis=month/);
  assert.match(html, /q=Plus/);
  const single = await render({ compare_region: "US", compare_page: "999" });
  assert.equal((single.match(/<td/g) ?? []).length, 12);
  let cells = 0;
  for (let page = 1; page <= 4; page++) {
    const part = await render({ compare_region: "US", compare_rows_page: String(page) });
    cells += (part.match(/<td/g) ?? []).length;
    assert.match(part, /compare_region=US/);
  }
  assert.equal(cells, 39, "all combinations remain reachable across row pages");
  const later = await render({ compare_page: "2", compare_rows_page: "2", compare_basis: "month" });
  assert.match(later, /compare_rows_page=2/);
  assert.match(later, /compare_page=2/);
  assert.match(later, /compare_basis=month/);
  assert.doesNotMatch(single, /下一组地区/);
});


test("cross-region lowest label does not change when the cheaper region is on another page", async () => {
  const price: OfficialSubscriptionPrice = {
    id: "us", vendor: "openai", planCode: "chatgpt-plus-monthly", planName: "ChatGPT Plus", billingPeriod: "month",
    channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: "20", lowerAmount: null, upperAmount: null,
    cnyEstimate: "140", rawPlanName: "ChatGPT Plus", appId: null, evidenceUrl: "https://example.com",
    verifiedAt: new Date(), exchangeRateDate: new Date().toISOString().slice(0,10), exchangeRateUrl: null, historyCount: 1,
    evidence: { billingPeriod: "month", billingEvidenceUrl: "https://example.com" },
  };
  const rows = [price, {...price, id: "ph", countryCode: "PH", cnyEstimate: "100"}];
  const firstPage = await render({}, rows);
  assert.ok(!firstPage.includes("同渠道跨地区标价折算较低"), "US must not become lowest just because PH is on page two");
  const secondPage = await render({compare_page: "2"}, rows);
  assert.ok(secondPage.includes("同渠道跨地区标价折算较低"));
  const last = await render({ compare_page: "999999" });
  assert.ok(!last.includes("下一组地区"));
  assert.equal(await render({compare_page:"-1"}), await render());
});
