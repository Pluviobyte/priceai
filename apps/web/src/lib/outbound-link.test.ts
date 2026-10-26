import assert from "node:assert/strict";
import test from "node:test";
import { withReferralTags } from "./outbound-link";

test("buy links carry referral tags without overriding the shop's own", () => {
  assert.equal(withReferralTags(new URL("https://wzyp.cn/item/byeuus")).href,
    "https://wzyp.cn/item/byeuus?utm_source=priceai&utm_medium=referral&utm_campaign=price_compare");
  const own = withReferralTags(new URL("https://shop.example/goods/1?utm_source=partner&id=7#buy"));
  assert.equal(own.searchParams.get("utm_source"), "partner");
  assert.equal(own.searchParams.get("id"), "7");
  assert.equal(own.searchParams.get("utm_medium"), "referral");
  assert.equal(own.hash, "#buy");
});
