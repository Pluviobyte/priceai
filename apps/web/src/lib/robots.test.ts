import assert from "node:assert/strict";
import test from "node:test";
import { robotsText } from "./robots";

test("robots.txt keeps training crawlers out but lets Chinese search engines in", () => {
  const text = robotsText("https://priceai.io");
  assert.match(text, /^User-agent: \*\nContent-Signal: search=yes,ai-train=no\nAllow: \//);
  assert.match(text, /User-agent: GPTBot\nDisallow: \//);
  assert.doesNotMatch(text, /Baiduspider|PetalBot/);
  assert.match(text, /Disallow: \/out\//);
  assert.match(text, /Sitemap: https:\/\/priceai\.io\/sitemap\.xml/);
});
