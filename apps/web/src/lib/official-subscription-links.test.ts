import test from "node:test";
import assert from "node:assert/strict";
import { officialPageUrl, officialPriceHref, isPricingInterface } from "./official-subscription-links";

test("regional checkout evidence never becomes the price navigation destination", () => {
  const evidence = "https://chatgpt.com/backend-anon/checkout_pricing_config/configs/ID";
  const row = { vendor: "OpenAI", planCode: "chatgpt-go-monthly", id: "indonesia", evidenceUrl: evidence };
  assert.equal(officialPriceHref(row), "/official-prices/openai__chatgpt-go-monthly#quote-indonesia");
  assert.equal(officialPageUrl(evidence), "https://chatgpt.com/pricing/");
  assert.equal(row.evidenceUrl, evidence);
  assert.equal(isPricingInterface(evidence), true);
});

test("public store and help evidence stays intact and is not labelled as an interface", () => {
  for (const url of ["https://apps.apple.com/id/app/id6448311069", "https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus", "https://chatgpt.com/pricing/"]) {
    assert.equal(isPricingInterface(url), false);
    assert.equal(officialPageUrl(url), url);
  }
  assert.equal(isPricingInterface("invalid"), false);
  assert.equal(officialPageUrl("https://example.com/backend-anon/test"), "https://example.com/backend-anon/test");
});
