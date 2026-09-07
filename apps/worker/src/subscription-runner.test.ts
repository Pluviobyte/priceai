import assert from "node:assert/strict";
import test from "node:test";
import { sweepIsDue } from "./subscription-runner.js";
test("full-sweep timing uses successful completion and retries failures after an hour", () => {
  const now = Date.now(), day=86_400_000;
  assert.equal(sweepIsDue(null,null,now,day),true);
  assert.equal(sweepIsDue(new Date(now-day+60000),null,now,day),false);
  assert.equal(sweepIsDue(new Date(now-day-60000),new Date(now-3600001),now,day),true);
  assert.equal(sweepIsDue(null,new Date(now-60000),now,day),false);
});
