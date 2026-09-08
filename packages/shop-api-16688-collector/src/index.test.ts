import assert from "node:assert/strict";
import test from "node:test";
import { Sixteen688ShopCollector, cleanText, stockFor } from "./index.js";

const context = { sourceId: "source", now: new Date("2026-09-08T08:00:00.000Z"), signal: new AbortController().signal };
const sample = {
  goods_no: "G95962661",
  name: "【全自动秒到】Claude MAX 5x 会员官方直充",
  description: "<p><span>自助激活</span></p><p>无售后</p>",
  price: 852,
  stock_available_quantity: -1,
  stock_available_status: "",
  delivery_method: 3,
  limit_quantity: 1,
  sales_count_text: "",
  promo_tags: [],
};

test("normalises a 16688 goods item into a raw offer", () => {
  const collector = new Sixteen688ShopCollector();
  const offer = collector.normalizeItem(sample, context);
  assert.equal(offer.sourceItemId, "G95962661");
  assert.equal(offer.price, "852");
  assert.equal(offer.currency, "CNY");
  assert.equal(offer.stockState, "unknown");
  assert.equal(offer.productUrl, "https://www.16688.com.cn/goods/G95962661");
  assert.equal(offer.rawDescription, "自助激活\n无售后");
  assert.equal(offer.capturedAt, "2026-09-08T08:00:00.000Z");
});

test("stock mapping distinguishes counted, sold out and unknown stock", () => {
  assert.deepEqual(stockFor({ stock_available_quantity: 5 }), { stockState: "in_stock", stockCount: 5 });
  assert.deepEqual(stockFor({ stock_available_quantity: 0 }), { stockState: "out_of_stock", stockCount: 0 });
  assert.deepEqual(stockFor({ stock_available_quantity: -1, stock_available_status: "sold_out" }), { stockState: "out_of_stock" });
  assert.deepEqual(stockFor({ stock_available_quantity: -1 }), { stockState: "unknown" });
});

test("validation requires one complete page without duplicate goods numbers", () => {
  const collector = new Sixteen688ShopCollector();
  const complete = collector.validateSnapshot([{ items: [sample, { ...sample, goods_no: "G2" }], cursor: "1", expectedTotal: 2, rawPayloadHash: "x".repeat(16) }]);
  assert.equal(complete.completeSnapshot, true);
  assert.equal(complete.parsedTotal, 2);
  const duplicated = collector.validateSnapshot([{ items: [sample, sample], cursor: "1", expectedTotal: 2, rawPayloadHash: "x".repeat(16) }]);
  assert.equal(duplicated.completeSnapshot, false);
  assert.equal(duplicated.status, "partial");
  const broken = collector.validateSnapshot([{ items: [{ name: "no id" }], cursor: "1", rawPayloadHash: "x".repeat(16) }]);
  assert.equal(broken.status, "failed");
});

test("only 16688 shop and goods URLs are probed", () => {
  assert.deepEqual(Sixteen688ShopCollector.parseUrl(new URL("https://16688.com.cn/shop/S937885")), { kind: "shop", id: "S937885" });
  assert.deepEqual(Sixteen688ShopCollector.parseUrl(new URL("https://www.16688.com.cn/goods/G67930756")), { kind: "goods", id: "G67930756" });
  assert.equal(Sixteen688ShopCollector.parseUrl(new URL("https://wzyp.cn/shop/S937885")), null);
  assert.equal(Sixteen688ShopCollector.parseUrl(new URL("https://www.16688.com.cn/source")), null);
});

test("html cleanup keeps paragraph breaks", () => {
  assert.equal(cleanText("<h1>标题</h1><p>第一行</p><p>第二行&nbsp;end</p>"), "标题\n第一行\n第二行 end");
});
