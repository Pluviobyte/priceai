import assert from "node:assert/strict";
import test from "node:test";
import { isFreshOfficialSubscriptionPrice, hasCurrentCnyEstimate, selectOfficialSubscriptionReference, type OfficialSubscriptionPrice } from "./public-pricing";

const now = Date.parse("2026-09-07T09:00:00Z");
const listing = {
  verifiedAt: new Date("2026-09-07T08:00:00Z"), billingPeriod: "month",
  channel: "app_store", rawPlanName: "Google AI Pro (5 TB)",
  evidenceUrl: "https://apps.apple.com/us/app/id6477489729", collectionStatus: "verified",
};

test("a recently parsed Apple amount without a billing period is not a verified monthly quote", () => {
  assert.equal(isFreshOfficialSubscriptionPrice(listing, now), false);
});

test("an explicitly monthly listing can be compared, unless its SKU is ambiguous or removed", () => {
  const monthly = { ...listing, rawPlanName: "Claude Pro - Monthly" };
  assert.equal(isFreshOfficialSubscriptionPrice(monthly, now), true);
  assert.equal(isFreshOfficialSubscriptionPrice({ ...monthly, collectionStatus: "ambiguous_sku" }, now), false);
  assert.equal(isFreshOfficialSubscriptionPrice({ ...monthly, collectionStatus: "sku_not_listed" }, now), false);
});

test("OpenAI standard plan documents may confirm period without claiming checkout verification", () => {
  assert.equal(isFreshOfficialSubscriptionPrice({ ...listing, rawPlanName: "ChatGPT Go", evidence: {
    billingPeriod: "month", billingEvidenceUrl: "https://help.openai.com/en/articles/11989085-what-is-chatgpt-go", checkoutVerified: false,
  } }, now), true);
});

test("a reference prefers the US website over a cheaper foreign storefront", () => {
  const base: OfficialSubscriptionPrice = { ...listing, id: "base", vendor: "openai", planCode: "chatgpt-pro-20x-monthly", planName: "ChatGPT Pro 20x", countryCode: "US", currency: "USD", lowerAmount: null, upperAmount: null, cnyEstimate: null, appId: null, exchangeRateDate: "2026-09-04", exchangeRateUrl: null, historyCount: 1, priceKind: "exact", amount: "200", evidence: {
    billingPeriod: "month", billingEvidenceUrl: "https://chatgpt.com/plans/pro/",
  } };
  const philippines = { ...base, id: "ph", countryCode: "PH", channel: "app_store", amount: "9990", cnyEstimate: "1070.10" };
  const us = { ...base, id: "us", countryCode: "US", channel: "web", cnyEstimate: "1342.18" };
  assert.equal(selectOfficialSubscriptionReference([philippines, us], now)?.id, "us");
});

test("a fresh quote cannot rank with a stale, future or invalid exchange estimate", () => {
  assert.equal(hasCurrentCnyEstimate({ cnyEstimate: "134.22", exchangeRateDate: "2026-09-04" }, now), true);
  for (const exchangeRateDate of ["2026-08-01", "2099-01-01", "bad"]) {
    assert.equal(hasCurrentCnyEstimate({ cnyEstimate: "134.22", exchangeRateDate }, now), false);
  }
});
