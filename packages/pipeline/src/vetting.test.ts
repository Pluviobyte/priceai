import assert from "node:assert/strict";
import test from "node:test";
import type { RawOfferInput } from "@price-radar/schema";
import { buildSourceQualityProfile, decideVetting, type SourceQualityProfile } from "./vetting.js";
import { tokens } from "./quality.js";

function item(title: string, price: string, extra: Partial<RawOfferInput> = {}): RawOfferInput {
  return {
    sourceItemId: title,
    rawTitle: title,
    rawPriceText: price,
    price,
    currency: "CNY",
    stockState: "in_stock",
    productUrl: "https://wzyp.cn/item/x",
    capturedAt: "2026-09-08T00:00:00.000Z",
    rawPayloadHash: "h".repeat(16),
    ...extra,
  };
}

const baseProfile: SourceQualityProfile = {
  itemCount: 10, aiRelevantCount: 6, aiConfidentCount: 5, aiRelevantShare: 0.6, inStockCount: 8, outOfStockShare: 0.2, noWarrantyShare: 0.3,
  riskFactCount: 3, contactPresent: true, priceOutlierShare: null, priceComparableCount: 0, catalogOverlapMax: 0.1, catalogOverlapSourceId: "other", merchantCreatedAt: null, products: { "chatgpt-plus": 6 },
};

test("profiles count AI relevant items, stock, warranty wording and contacts", () => {
  const items = [
    item("ChatGPT Plus 一个月 代充 无质保 QQ:123456789", "23"),
    item("Claude Pro 月付 成品号", "67", { stockState: "out_of_stock" }),
    item("谷歌邮箱 老号", "3"),
    item("Steam 游戏充值卡", "50"),
  ];
  const profile = buildSourceQualityProfile(items, { comparables: new Map(), otherCatalogs: [] });
  assert.equal(profile.itemCount, 4);
  assert.equal(profile.aiRelevantCount >= 2, true);
  assert.equal(profile.inStockCount, 3);
  assert.equal(profile.outOfStockShare, 0.25);
  assert.equal(profile.contactPresent, true);
  assert.ok(profile.noWarrantyShare > 0);
  assert.ok(profile.products["chatgpt-plus"]);
});

test("profiles flag catalogs copied from an existing source and prices far below market", () => {
  const titles = ["ChatGPT Plus 一个月 代充 首登质保", "ChatGPT Pro 5x 成品号 质保7天", "Claude Pro 月付 直充"];
  const items = titles.map((title) => item(title, "1"));
  const profile = buildSourceQualityProfile(items, {
    comparables: new Map([["chatgpt-plus", [20, 22, 23, 25, 26]], ["chatgpt-pro-5x", [400, 420, 450, 460, 480]], ["claude-pro", [60, 65, 67, 70, 72]]]),
    otherCatalogs: [{ sourceId: "mirror", titleTokens: titles.map(tokens) }, { sourceId: "unrelated", titleTokens: [tokens("Gemini Pro 年卡")] }],
  });
  assert.equal(profile.catalogOverlapMax, 1);
  assert.equal(profile.catalogOverlapSourceId, "mirror");
  assert.equal(profile.priceComparableCount, 3);
  assert.equal(profile.priceOutlierShare, 1);
  const decision = decideVetting(profile, { complete: true, status: "success" });
  assert.equal(decision.verdict, "review");
  assert.ok(decision.reasons.some((reason) => reason.startsWith("catalog_mirror_suspected")));
  assert.ok(decision.reasons.includes("prices_far_below_market"));
});

test("verdicts: incomplete trial → review, empty or non-AI catalog → rejected with retry, good catalog → approved", () => {
  assert.equal(decideVetting(baseProfile, { complete: false, status: "partial" }).verdict, "review");
  const empty = decideVetting({ ...baseProfile, itemCount: 0, aiRelevantCount: 0 }, { complete: true, status: "success" });
  assert.equal(empty.verdict, "rejected");
  assert.equal(empty.retryAfterDays, 30);
  const nonAi = decideVetting({ ...baseProfile, aiRelevantCount: 0, aiRelevantShare: 0 }, { complete: true, status: "success" });
  assert.deepEqual(nonAi.reasons, ["no_ai_relevant_items"]);
  const good = decideVetting(baseProfile, { complete: true, status: "success" });
  assert.equal(good.verdict, "approved");
  const thin = decideVetting({ ...baseProfile, itemCount: 40, aiRelevantCount: 2, aiConfidentCount: 2, aiRelevantShare: 0.05 }, { complete: true, status: "success" });
  assert.equal(thin.verdict, "review");
  assert.ok(thin.reasons[0]?.startsWith("low_ai_relevance"));
});


test("low confidence AI matches never enable a source automatically", () => {
  const decision = decideVetting({ ...baseProfile, aiConfidentCount: 0 }, { complete: true, status: "success" });
  assert.equal(decision.verdict, "review");
  assert.ok(decision.reasons.includes("no_confident_ai_matches"));
});
