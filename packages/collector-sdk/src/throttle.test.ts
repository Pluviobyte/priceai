import assert from "node:assert/strict";
import test from "node:test";
import { HostThrottle } from "./throttle.js";

test("host throttle spaces requests to one host and isolates hosts", async () => {
  const throttle = new HostThrottle({ minIntervalMs: 60, jitterMs: 0, maxConcurrency: 8 });
  const started: number[] = [];
  const begin = Date.now();
  await Promise.all([
    throttle.run("shop.example", async () => { started.push(Date.now() - begin); }),
    throttle.run("shop.example", async () => { started.push(Date.now() - begin); }),
    throttle.run("shop.example", async () => { started.push(Date.now() - begin); }),
  ]);
  started.sort((left, right) => left - right);
  assert.ok((started[2] ?? 0) >= 100, `third request should wait about 120ms, got ${started[2]}`);
  const otherBegin = Date.now();
  await throttle.run("other.example", async () => undefined);
  assert.ok(Date.now() - otherBegin < 50, "a different host must not inherit the wait");
});

test("host throttle caps concurrency per host", async () => {
  const throttle = new HostThrottle({ minIntervalMs: 0, jitterMs: 0, maxConcurrency: 1 });
  let active = 0;
  let peak = 0;
  await Promise.all(Array.from({ length: 4 }, () => throttle.run("busy.example", async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active -= 1;
  })));
  assert.equal(peak, 1);
});

test("cooldown delays the next request", async () => {
  const throttle = new HostThrottle({ minIntervalMs: 0, jitterMs: 0 });
  throttle.cooldown("cool.example", 80);
  const begin = Date.now();
  await throttle.run("cool.example", async () => undefined);
  assert.ok(Date.now() - begin >= 70);
});
