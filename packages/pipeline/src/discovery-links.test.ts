import assert from "node:assert/strict";
import test from "node:test";
import { extractMentionedUrls, extractMentionedUrlsWithContext, isUtilityHost, leadsFromCrawledRows, mentionLooksLikeShop } from "./discovery-links.js";

test("extracts full URLs and bare domains from Chinese product descriptions", () => {
  const text = "备用店铺：https://8t92.cc/shop/AB12CD34，教程见 https://www.yuque.com/x/y。镜像域名 chaai.cc，接码 sms.nloop.cc（自助）";
  assert.deepEqual(extractMentionedUrls(text), [
    "https://8t92.cc/shop/AB12CD34",
    "https://www.yuque.com/x/y",
    "https://chaai.cc/",
    "https://sms.nloop.cc/",
  ]);
  assert.deepEqual(extractMentionedUrls("联系 QQ 123456，无链接"), []);
  // Malformed hosts never become leads.
  assert.deepEqual(extractMentionedUrls("看 https://www.&/ 和 https://fyui.xn--top-jx3ep93c4x6a8hc/ 以及 https://ok.example/"), ["https://fyui.xn--top-jx3ep93c4x6a8hc/", "https://ok.example/"]);
});

test("supporting-tool hosts are recognised by name, label and suffix", () => {
  for (const host of ["2fa.fun", "2fa.run", "sms.linlinflow.ccwu.cc", "mail.chatai.codes", "convert.13916454.xyz", "session.ameng2027.xyz", "www.gmailcheck.com", "ping0.cc", "github.com", "aistore.notion.site", "docs.qq.com", "tinyurl.com", "t.me", "chatgpt.com", "hero-sms.com", "tmail.xuanlich.com", "getsms.website", "boardermail.com", "www.yunmasms.asia", "gpt.hjwl.email", "wwbch.lanzouw.com", "dtpz123.lanzouu.com", "h.vmos.cn", "logged-lance.trycloudflare.com", "kw-stillhappy.duckdns.org", "u38731018b1.ccwu.cc"]) {
    assert.equal(isUtilityHost(host), true, host);
  }
  for (const host of ["chaai.cc", "8t92.cc", "vip666ai.com", "wzyp.cn", "shop.gpt.ge", "xingbao-ai.shop", "plus.eidolon-ai.com"]) {
    assert.equal(isUtilityHost(host), false, host);
  }
});

test("crawled rows become deduplicated shop leads without self links, tools or platform home pages", () => {
  const rows = [
    { sourceId: "s1", sourceHost: "wzyp.cn", sourceEntryUrl: "https://wzyp.cn/shop/SELF0001", productUrl: "https://wzyp.cn/item/a1", rawDescription: "分店 https://wzyp.cn/shop/OTHER1 主页 https://wzyp.cn/ 本店 https://wzyp.cn/shop/SELF0001 商品 https://wzyp.cn/item/a1 接码 https://2fa.fun/" },
    { sourceId: "s2", sourceHost: "catfk.com", productUrl: "https://catfk.com/item/b2", rawDescription: "也可以在 https://wzyp.cn/shop/OTHER1 购买，官网 chaai.cc，教程 https://blog.someone.dev/how-to" },
    { sourceId: "s3", sourceHost: "chaai.cc", productUrl: "https://chaai.cc/buy/3", rawDescription: "本站 https://chaai.cc/buy/3 无其他" },
    { sourceId: "s4", sourceHost: "x.example", productUrl: "https://x.example/p", rawDescription: null },
  ];
  const leads = leadsFromCrawledRows(rows);
  assert.deepEqual(leads.map((lead) => [lead.url, lead.mentionedBy, lead.discoveryUrl]), [
    ["https://wzyp.cn/shop/OTHER1", 2, "https://wzyp.cn/item/a1"],
    ["https://chaai.cc/", 1, "https://catfk.com/item/b2"],
  ]);
  assert.equal(leads[0]?.provider, "crawled_catalog_links");
  assert.equal(leads[0]?.discoveryKind, "crawl");
});

test("only mentions that look like shop addresses are kept", () => {
  const [tutorial] = extractMentionedUrlsWithContext("详细教程见 https://blog.someone.dev/how-to 请先阅读");
  const [shop] = extractMentionedUrlsWithContext("我们的备用店铺 https://ai666ok.com/ 支持自动发货");
  const [product] = extractMentionedUrlsWithContext("https://shop.gpt.ge/buy/18");
  assert.equal(mentionLooksLikeShop(tutorial!), false);
  assert.equal(mentionLooksLikeShop(shop!), true);
  assert.equal(mentionLooksLikeShop(product!), true);
  assert.equal(mentionLooksLikeShop({ url: "https://wzyp.cn/", context: "购买请到官网" }), false);
  assert.equal(mentionLooksLikeShop({ url: "https://wzyp.cn/shop/ABCD1234", context: "" }), true);
});
