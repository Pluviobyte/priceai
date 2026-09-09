import assert from "node:assert/strict";
import test from "node:test";
import { WafChallengeError } from "@price-radar/collector-sdk";
import { nextWafBlockedRun, nextFailedRun } from "./source-health.js";

test("WAF parking does not escalate the failure counter and uses a long retry", () => {
  const now = new Date("2026-09-08T00:00:00.000Z");
  const parked = nextWafBlockedRun(now, 2);
  assert.equal(parked.healthStatus, "blocked_egress");
  assert.equal(parked.consecutiveFailures, 2, "failure counter is left untouched");
  assert.equal(parked.nextRunAt.getTime() - now.getTime(), 12 * 60 * 60_000);
  // A real failure at the same count would climb toward `failing` on a shorter ladder.
  const failed = nextFailedRun(now, 2);
  assert.equal(failed.healthStatus, "failing");
  assert.ok(parked.nextRunAt.getTime() > failed.nextRunAt.getTime());
});

test("WafChallengeError carries host and signature for routing", () => {
  const error = new WafChallengeError("wzyp.cn", "captchatype_esa");
  assert.equal(error.hostname, "wzyp.cn");
  assert.match(error.message, /^waf_challenge:wzyp\.cn:/);
});
