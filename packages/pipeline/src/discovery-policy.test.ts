import assert from "node:assert/strict";
import test from "node:test";
import { DISCOVERY_DAY_MS as day, DiscoveryHttpError, discoveryDecision, discoveryFailure } from "./discovery-policy.js";
const now = new Date("2026-09-20T10:00:00Z");
test("Retry-After seconds and HTTP dates are respected beyond the local cooldown", () => {
  for (const header of ["172800", "Tue, 22 Sep 2026 10:00:00 GMT"]) {
    const error = new DiscoveryHttpError("directory_http_429:example.com", 429, header, +now);
    assert.equal(discoveryFailure(error, now, 1).retryAt, "2026-09-22T10:00:00.000Z");
  }
  for (const header of ["garbage", "-10", "0", null]) {
    assert.equal(discoveryFailure(new DiscoveryHttpError("http429", 429, header, +now), now, 1).retryAt, new Date(+now + day).toISOString());
  }
});
test("ordinary failures back off exponentially and cap at one day", () => {
  for (const [count, minutes] of [[1,15],[2,30],[3,60],[8,1440],[100,1440]]) {
    assert.equal(Date.parse(discoveryFailure(new Error("fetch failed"), now, count!).retryAt) - +now, minutes! * 60_000);
  }
});
test("a persisted failure wins over older success and cannot be bypassed by CLI", () => {
  const failed = { status:"failed", startedAt:now, finishedAt:now, errorMessage:"directory_http_429:priceai.cc", evidence:{} };
  const attempts = [failed, { ...failed, status:"success" }];
  assert.equal(discoveryDecision(attempts, undefined, new Date(+now+60_000))?.status, "deferred");
  assert.equal(discoveryDecision(attempts, day, new Date(+now+day)), null);
  assert.equal(discoveryDecision([{...failed,status:"success"}], day, now)?.status, "skipped");
  assert.equal(discoveryDecision([{...failed,status:"success"}], undefined, now), null);
});
