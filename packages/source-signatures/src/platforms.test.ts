import assert from "node:assert/strict";
import test from "node:test";
import { canonicalizeFamilyUrl, failoverOrigins, resolveCandidateIdentity, shopApiPlatformKind } from "./platforms.js";

test("LDXP shops share one token space across mirror domains", () => {
  const viaPay = resolveCandidateIdentity("https://pay.ldxp.cn/shop/2VWX76A4?from=x#top");
  const viaWzyp = resolveCandidateIdentity("https://wzyp.cn/shop/2VWX76A4");
  const viaLdxp = resolveCandidateIdentity("https://www.ldxp.cn/shop/2VWX76A4/");
  assert.deepEqual(viaPay, viaWzyp);
  assert.deepEqual(viaLdxp, viaWzyp);
  assert.equal(viaWzyp?.platformKind, "ldxp_shop_api");
  assert.equal(viaWzyp?.platformMerchantId, "2VWX76A4");
  assert.equal(viaWzyp?.canonicalUrl, "https://wzyp.cn/shop/2VWX76A4");
});

test("custom LDXP aliases keep their case and punctuation", () => {
  const identity = resolveCandidateIdentity("https://pay.ldxp.cn/shop/Esaai.com");
  assert.equal(identity?.platformMerchantId, "Esaai.com");
  assert.equal(resolveCandidateIdentity("https://pay.ldxp.cn/shop/echo_dream")?.platformMerchantId, "echo_dream");
  assert.equal(resolveCandidateIdentity("https://pay.ldxp.cn/shop/cursor-pro")?.platformMerchantId, "cursor-pro");
});

test("LDXP item links only carry a platform hint until the shop token is resolved", () => {
  const identity = resolveCandidateIdentity("https://wzyp.cn/item/84qh0k");
  assert.equal(identity?.kind, "item");
  assert.equal(identity?.platformKind, "ldxp_shop_api");
  assert.equal(identity?.platformMerchantId, undefined);
  assert.equal(identity?.canonicalUrl, "https://wzyp.cn/item/84qh0k");
});

test("catfk.com is a separate token space on the same software", () => {
  const identity = resolveCandidateIdentity("https://catfk.com/shop/YIXOQD2E");
  assert.equal(identity?.platformKind, "shop_api@catfk.com");
  assert.equal(identity?.platformMerchantId, "YIXOQD2E");
  assert.equal(shopApiPlatformKind("catfk.com"), "shop_api@catfk.com");
  assert.equal(shopApiPlatformKind("WZYP.cn"), "ldxp_shop_api");
});

test("16688 shops and goods normalise onto the www origin", () => {
  const shop = resolveCandidateIdentity("https://16688.com.cn/shop/S937885");
  assert.equal(shop?.platformKind, "shop_api_16688");
  assert.equal(shop?.platformMerchantId, "S937885");
  assert.equal(shop?.canonicalUrl, "https://www.16688.com.cn/shop/S937885");
  const goods = resolveCandidateIdentity("https://16688.com.cn/goods/G67930756");
  assert.equal(goods?.kind, "item");
  assert.equal(goods?.canonicalUrl, "https://www.16688.com.cn/goods/G67930756");
});

test("platform home pages are not shops", () => {
  assert.equal(resolveCandidateIdentity("https://wzyp.cn/"), null);
  assert.equal(resolveCandidateIdentity("https://www.16688.com.cn/source"), null);
  assert.equal(resolveCandidateIdentity("ftp://wzyp.cn/shop/A"), null);
  assert.equal(resolveCandidateIdentity("not a url"), null);
});

test("self-hosted shops dedupe on hostname", () => {
  const identity = resolveCandidateIdentity("https://98-xj.com/products/123");
  assert.equal(identity?.platformKind, "web");
  assert.equal(identity?.platformMerchantId, "98-xj.com");
  assert.equal(identity?.canonicalUrl, "https://98-xj.com/");
});

test("failover origins and canonicalisation follow the family", () => {
  assert.deepEqual(failoverOrigins("https://pay.ldxp.cn"), ["https://wzyp.cn", "https://www.wzyp.cn", "https://www.ldxp.cn", "https://ldxp.cn"]);
  assert.deepEqual(failoverOrigins("https://catfk.com"), []);
  assert.equal(canonicalizeFamilyUrl("https://pay.ldxp.cn/shop/abc"), "https://wzyp.cn/shop/abc");
  assert.equal(canonicalizeFamilyUrl("https://catfk.com/shop/abc?x=1"), "https://catfk.com/shop/abc");
});
