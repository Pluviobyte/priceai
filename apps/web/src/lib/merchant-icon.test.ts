import assert from "node:assert/strict";
import test from "node:test";
import { merchantIconUrl } from "./merchant-icon";

test("shared shop platforms use local icons across their aliases", () => {
  for (const host of ["wzyp.cn", "www.wzyp.cn", "pay.ldxp.cn", "ldxp.cn", "www.ldxp.cn"]) {
    assert.equal(merchantIconUrl(`https://${host}/shop/example`), "/merchant-icons/wzyp.ico");
  }
  assert.equal(merchantIconUrl("https://www.16688.com.cn/shop/123"), "/merchant-icons/16688.png");
});

test("independent shops use only their origin favicon without path or tracking", () => {
  assert.equal(merchantIconUrl("https://98-xj.com/shop/item?token=secret#foo"), "https://98-xj.com/favicon.ico");
  assert.equal(merchantIconUrl("https://wzyp.cn.example.com/shop/a"), "https://wzyp.cn.example.com/favicon.ico");
});

test("unusable and local sources keep the placeholder", () => {
  for (const source of [null, "bad", "javascript:alert(1)", "http://shop.example.com", "https://user:pass@shop.example.com", "https://127.0.0.1", "https://[::1]", "https://localhost", "https://shop.local"]) {
    assert.equal(merchantIconUrl(source), null);
  }
});
