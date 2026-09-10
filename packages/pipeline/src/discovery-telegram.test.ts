import assert from "node:assert/strict";
import test from "node:test";
import { extractTelegramHandles, parseTelegramChannelPage } from "./discovery-telegram.js";

test("public channel handles are extracted; invite links and reserved paths are not", () => {
  assert.deepEqual(extractTelegramHandles("加入 https://t.me/tora_aishop 或 t.me/s/XiaoManAPI 私聊 https://t.me/+z4sg5htnxhu1MDFh 和 https://t.me/joinchat/abc"), ["tora_aishop", "xiaomanapi"]);
  assert.deepEqual(extractTelegramHandles("https://t.me/c/123456/7"), []);
});

test("channel pages yield posts, links and the older-page cursor", () => {
  const html = `<div class="tgme_channel_info_header_title"><span dir="auto">AI 小店公告</span></div>
    <a class="tme_messages_more" href="/s/aishop?before=42" data-before="42">Load more</a>
    <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="aishop/42">
      <div class="tgme_widget_message_text js-message_text" dir="auto">新店上线 <a href="https://wzyp.cn/shop/NEWSHOP1?utm=tg" target="_blank">wzyp.cn/shop/NEWSHOP1</a><br/>备用 <a href="https://8t92.cc/">8t92.cc</a> 频道 <a href="https://t.me/partner_shop">@partner_shop</a> &amp; 接码 <a href="https://2fa.fun/">2fa</a></div>
    </div></div>
    <div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="aishop/43">
      <div class="tgme_widget_message_text js-message_text" dir="auto">纯文字公告</div></div></div>`;
  const page = parseTelegramChannelPage(html);
  assert.equal(page.title, "AI 小店公告");
  assert.equal(page.before, 42);
  assert.deepEqual(page.messages.map((message) => message.post), ["aishop/42", "aishop/43"]);
  assert.deepEqual(page.messages[0]?.links, ["https://wzyp.cn/shop/NEWSHOP1?utm=tg", "https://8t92.cc/", "https://t.me/partner_shop", "https://2fa.fun/"]);
  assert.match(page.messages[0]?.text ?? "", /新店上线 wzyp\.cn\/shop\/NEWSHOP1/);
  assert.equal(parseTelegramChannelPage("<html><body>Channel not found</body></html>").messages.length, 0);
});
