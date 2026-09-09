import assert from "node:assert/strict";
import test from "node:test";
import { WafChallengeError, isWafChallengeError, mentionsWafChallenge, wafChallengeSignature } from "./waf.js";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

test("Aliyun ESA challenge bodies are recognised", () => {
  const esa = '<html><head><script id="6cc" src="https://o.alicdn.com/x/jquery.min.js" captchaType="esa"></script></head></html>';
  assert.ok(wafChallengeSignature(headers({ server: "ESA" }), esa));
  assert.ok(wafChallengeSignature(headers({}), "<html>...acw_sc__v2...</html>"));
});

test("cookie-plus-reload shells are treated as challenges", () => {
  const body = '<html><script>document.cookie="x";location.reload()</script></html>';
  assert.ok(wafChallengeSignature(headers({ "set-cookie": "acw_tc=abc; path=/" }), body));
});

test("ordinary non-JSON bodies are not challenges", () => {
  assert.equal(wafChallengeSignature(headers({ "content-type": "text/html" }), "<html><body>404 Not Found</body></html>"), null);
  assert.equal(wafChallengeSignature(headers({ server: "ESA" }), "<html>plain page, no markers</html>"), null);
});

test("error helpers identify WAF challenges", () => {
  const error = new WafChallengeError("wzyp.cn", "server_esa");
  assert.equal(error.message, "waf_challenge:wzyp.cn:server_esa");
  assert.ok(isWafChallengeError(error));
  assert.ok(mentionsWafChallenge(error.message));
  assert.ok(!isWafChallengeError(new Error("shop_api_http_500")));
  assert.ok(!mentionsWafChallenge("timeout"));
});
