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
  // 12 combinations, 30 regions each, plus the one 官方底价 cell that summarises them.
  assert.ok((html.match(/<td/g) ?? []).length <= 372, "render at most 12 combinations and 30 regions");
  assert.ok(Buffer.byteLength(html) < 1_000_000, "empty matrix must stay under 1 MB");
  assert.match(html, /继续看后/);
});

test("region pagination preserves filters and explicit region stays directly accessible", async () => {
  const html = await render({ compare_page: "2", compare_vendor: "openai", compare_basis: "month", q: "Plus" });
  assert.match(html, /回到前/);
  assert.match(html, /compare_vendor=openai/);
  assert.match(html, /compare_basis=month/);
  assert.match(html, /q=Plus/);
  const single = await render({ compare_region: "US", compare_page: "999" });
  assert.equal((single.match(/<td/g) ?? []).length, 24, "one region cell and one floor cell per combination");
  let cells = 0;
  for (let page = 1; page <= 4; page++) {
    const part = await render({ compare_region: "US", compare_rows_page: String(page) });
    cells += (part.match(/<td/g) ?? []).length;
    assert.match(part, /compare_region=US/);
  }
  assert.equal(cells, 78, "all combinations remain reachable across row pages");
  const later = await render({ compare_page: "2", compare_rows_page: "2", compare_basis: "month" });
  assert.match(later, /compare_rows_page=2/);
  assert.match(later, /compare_page=2/);
  assert.match(later, /compare_basis=month/);
  assert.doesNotMatch(single, /继续看后/);
});


test("cross-region lowest label does not change when the cheaper region is on another page", async () => {
  const price: OfficialSubscriptionPrice = {
    id: "us", vendor: "openai", planCode: "chatgpt-plus-monthly", planName: "ChatGPT Plus", billingPeriod: "month",
    channel: "web", countryCode: "US", currency: "USD", priceKind: "exact", amount: "20", lowerAmount: null, upperAmount: null,
    cnyEstimate: "140", rawPlanName: "ChatGPT Plus", appId: null, evidenceUrl: "https://example.com",
    verifiedAt: new Date(), exchangeRateDate: new Date().toISOString().slice(0,10), exchangeRateUrl: null, historyCount: 1,
    evidence: { billingPeriod: "month", billingEvidenceUrl: "https://example.com" },
  };
  // Pick a region the first group cannot show, whatever the page size happens to be, so
  // this keeps testing the property rather than a page boundary: the cheapest region is
  // chosen across every matching region, and paging must not promote a dearer one.
  const headRegions = (html: string) => new Set([...(/<thead>([\s\S]*?)<\/thead>/.exec(html)?.[1] ?? "").matchAll(/<small>([A-Z]{2})<\/small>/g)].map(match => match[1]!));
  const onFirst = headRegions(await render());
  const offFirst = [...headRegions(await render({ compare_page: "999999" }))].filter(code => !onFirst.has(code));
  assert.ok(offFirst.length > 0, "the region pager must hold regions the first group omits");
  const rows = [price, { ...price, id: "cheap", countryCode: offFirst[0]!, cnyEstimate: "100" }];
  const firstPage = await render({}, rows);
  assert.ok(!firstPage.includes("同渠道跨地区标价折算较低"), "US must not become lowest just because the cheaper region is in another group");
  assert.ok(firstPage.includes("100.00"), "官方底价 reports the cheaper region even while its column is elsewhere");
  const lastPage = await render({ compare_page: "999999" }, rows);
  assert.ok(lastPage.includes("同渠道跨地区标价折算较低"));
  assert.ok(!lastPage.includes("继续看后"));
  assert.equal(await render({compare_page:"-1"}), await render());
});
