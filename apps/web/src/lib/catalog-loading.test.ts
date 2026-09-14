import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const requireForTest = createRequire(__filename);
requireForTest.extensions[".css"] = module => { module.exports = {}; };

test("loading shell never shadows the streamed page's real main heading", async () => {
  const { CatalogLoading } = await import("../app/catalog-loading");
  const html = renderToStaticMarkup(createElement(CatalogLoading, {title:"卡网订阅"}));
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /卡网订阅/);
  assert.doesNotMatch(html, /<h1\b/);
  const streamed = `${html}<h1>卡网商家，一览再比较</h1>`;
  assert.equal(streamed.match(/<h1\b[^>]*>(.*?)<\/h1>/)?.[1], "卡网商家，一览再比较");
});
