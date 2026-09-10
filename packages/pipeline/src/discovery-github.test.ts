import assert from "node:assert/strict";
import test from "node:test";
import { parseTopicRepositories } from "./discovery-github.js";
import { isAiRelatedGoodsName } from "./discovery-platforms.js";

test("topic pages list repository slugs and skip navigation links", () => {
  const html = `<a href="/topics/chatgpt" class="Link">topic</a>
    <h3><a href="/someone/chatgpt-daichong" class="Link text-bold wb-break-word" data-hydro-click="x">chatgpt-daichong</a></h3>
    <a href="/someone/chatgpt-daichong/stargazers" class="Link--muted">12</a>
    <h3><a href="/other-org/gpt.shop_mirror" class="Link text-bold">mirror</a></h3>
    <a href="/login" class="HeaderMenu-link">Sign in</a>`;
  assert.deepEqual(parseTopicRepositories(html), ["someone/chatgpt-daichong", "other-org/gpt.shop_mirror"]);
});

test("16688 goods outside the AI category are kept only when their names look like AI products", () => {
  for (const name of ["codex接马", "【质保首登】Grok Super Heavy一个月 成品号", "ChatGPT Plus 代充 1个月", "Claude Pro 月卡", "Cursor Pro 账号", "AI 会员充值"]) {
    assert.equal(isAiRelatedGoodsName(name), true, name);
  }
  for (const name of ["王者荣耀点券", "爱奇艺黄金会员月卡", "Steam 充值卡", "百度网盘会员"]) {
    assert.equal(isAiRelatedGoodsName(name), false, name);
  }
});
