import assert from "node:assert/strict";
import test from "node:test";
import { OFFICIAL_SUBSCRIPTION_REGION_CATALOG } from "./subscription-catalog.js";
import { APPLE_STOREFRONT_CATALOG, OFFICIAL_COUNTRY_CANDIDATES, findAppleStorefront, regionDisplayName } from "./storefront-catalog.js";

test("Apple storefront catalog has unique lower-case storefronts and ISO currencies", () => {
  const codes = APPLE_STOREFRONT_CATALOG.map((item) => item.countryCode);
  assert.equal(new Set(codes).size, codes.length);
  for (const item of APPLE_STOREFRONT_CATALOG) {
    assert.match(item.countryCode, /^[A-Z]{2}$/);
    assert.equal(item.storefront, item.countryCode.toLowerCase());
    assert.match(item.currency, /^[A-Z]{3}$/);
  }
  assert.ok(APPLE_STOREFRONT_CATALOG.length >= 170);
  assert.equal(OFFICIAL_COUNTRY_CANDIDATES.length, APPLE_STOREFRONT_CATALOG.length);
});

test("featured regions are a subset of the storefront catalog with matching currencies", () => {
  for (const region of OFFICIAL_SUBSCRIPTION_REGION_CATALOG) {
    const storefront = findAppleStorefront(region.countryCode);
    assert.ok(storefront, region.countryCode);
    assert.equal(storefront.currency, region.currency, region.countryCode);
  }
  assert.equal(findAppleStorefront("ar")?.currency, "USD");
  assert.equal(findAppleStorefront("VN")?.currency, "VND");
  assert.equal(findAppleStorefront("RS")?.currency, "EUR");
});

test("region display names are Chinese with fixed wording for sensitive regions", () => {
  assert.equal(regionDisplayName("IN"), "印度");
  assert.equal(regionDisplayName("TW"), "中国台湾");
  assert.equal(regionDisplayName("HK"), "中国香港");
  assert.equal(regionDisplayName("tr"), "土耳其");
  assert.equal(regionDisplayName("ZZ"), "ZZ");
  assert.equal(regionDisplayName("QQ"), "QQ");
});
