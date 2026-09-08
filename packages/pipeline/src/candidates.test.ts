import assert from "node:assert/strict";
import test from "node:test";
import { isPlausiblePublicUrl, leadIdentity, normalizeLeadUrl } from "./candidates.js";

test("lead URLs are filtered and normalised before identity resolution", () => {
  assert.equal(isPlausiblePublicUrl("https://wzyp.cn/shop/abc"), true);
  assert.equal(isPlausiblePublicUrl("http://127.0.0.1/shop/abc"), false);
  assert.equal(isPlausiblePublicUrl("https://user:pw@wzyp.cn/shop/abc"), false);
  assert.equal(isPlausiblePublicUrl("https://localhost/shop/abc"), false);
  assert.equal(isPlausiblePublicUrl("https://wzyp.cn:8443/shop/abc"), false);
  assert.equal(normalizeLeadUrl("https://WZYP.cn/shop/abc?utm=1#x"), "https://wzyp.cn/shop/abc");
});

test("leads from different directories collapse to one identity", () => {
  const a = leadIdentity({ url: "https://pay.ldxp.cn/shop/2VWX76A4", provider: "aihaotan_shops", discoveryKind: "directory" });
  const b = leadIdentity({ url: "https://wzyp.cn/shop/2VWX76A4?ref=cardnav", provider: "cardnav_shop_products", discoveryKind: "directory" });
  assert.ok(a && b);
  assert.equal(a.platformKind, b.platformKind);
  assert.equal(a.platformMerchantId, b.platformMerchantId);
  assert.equal(a.canonicalUrl, "https://wzyp.cn/shop/2VWX76A4");
  assert.equal(leadIdentity({ url: "javascript:alert(1)", provider: "x", discoveryKind: "search" }), null);
});
