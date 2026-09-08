import assert from "node:assert/strict";
import test from "node:test";
import { parseAibijiaProducts, parseAihaotanShops, parseCardnavShopProducts, parsePriceAiMerchants } from "./discovery-directories.js";
import { parseCategoryTree } from "./discovery-platforms.js";

test("PriceAI merchant rows become directory leads with store names", () => {
  const leads = parsePriceAiMerchants({ rows: [
    { shopUrl: "https://98-xj.com", entryUrl: "https://98-xj.com/", name: "小久卡网", storeName: "小久卡网", collectorKind: "dujiao" },
    { entryUrl: "https://wzyp.cn/shop/aicloudhub", name: "AI Cloud" },
    { name: "no url" },
  ], total: 3 }, "https://priceai.cc/api/merchants?limit=200&offset=0");
  assert.equal(leads.length, 2);
  assert.equal(leads[0]?.url, "https://98-xj.com");
  assert.equal(leads[0]?.nameHint, "小久卡网");
  assert.equal(leads[1]?.url, "https://wzyp.cn/shop/aicloudhub");
  assert.equal(leads[0]?.discoveryKind, "directory");
});

test("AI号探 shops and CardNav packed sites parse into leads", () => {
  const aihaotan = parseAihaotanShops([{ url: "https://pay.ldxp.cn/shop/2VWX76A4", name: "牟利ai", platform: "LDXP" }, { name: "broken" }], "https://www.aihaotan.com/api/shops");
  assert.deepEqual(aihaotan.map((lead) => lead.url), ["https://pay.ldxp.cn/shop/2VWX76A4"]);
  assert.equal(aihaotan[0]?.nameHint, "牟利ai");
  const cardnav = parseCardnavShopProducts({ s: [["id1", "AI小铺", "https://catfk.com/shop/YIXOQD2E", 1788840047117, 166.9, 0], ["id2", "nourl", 12]] }, "https://cardnav.xyz/api/shop-products.json");
  assert.equal(cardnav.length, 1);
  assert.equal(cardnav[0]?.url, "https://catfk.com/shop/YIXOQD2E");
  assert.equal(cardnav[0]?.nameHint, "AI小铺");
});

test("Aibijia offers contribute item links with the store name", () => {
  const leads = parseAibijiaProducts({ products: [{ offers: [{ url: "https://wzyp.cn/item/84qh0k", source_store_name: "AI小店" }, { url: "" }] }] }, "https://data.aibijia.org/products.json");
  assert.equal(leads.length, 1);
  assert.equal(leads[0]?.url, "https://wzyp.cn/item/84qh0k");
  assert.equal(leads[0]?.nameHint, "AI小店");
});

test("16688 category tree puts the AI category first", () => {
  const categories = parseCategoryTree({ list: [{ id: 2, name: "游戏相关" }, { id: 1, name: "AI与效率", children: [{ id: 11, name: "子类" }] }] });
  assert.equal(categories[0]?.name, "AI与效率");
  assert.equal(categories.length, 3);
});
