import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncCache } from "./async-cache";

test("async cache shares concurrent reads and expires successful values", async () => {
  let time = 0, reads = 0;
  const cache = createAsyncCache<string, number>({ ttlMs: 30, maxEntries: 2, now: () => time });
  let release!: (value: number) => void;
  const load = () => { reads++; return new Promise<number>(resolve => { release = resolve; }); };
  const first = cache.get("generation-a", load);
  const second = cache.get("generation-a", load);
  assert.equal(reads, 1);
  release(7);
  assert.deepEqual(await Promise.all([first, second]), [7, 7]);
  assert.equal(await cache.get("generation-a", async () => 8), 7);
  time = 31;
  assert.equal(await cache.get("generation-a", async () => ++reads), 2);
  assert.deepEqual(cache.stats(), { hits: 1, misses: 2, coalesced: 1, evictions: 0, size: 1, pending: 0 });
});

test("async cache never retains failures and remains bounded", async () => {
  const cache = createAsyncCache<string, string>({ ttlMs: 100, maxEntries: 2 });
  await assert.rejects(cache.get("bad", async () => { throw new Error("failed"); }));
  assert.equal(await cache.get("bad", async () => "recovered"), "recovered");
  await cache.get("b", async () => "b");
  await cache.get("c", async () => "c");
  assert.equal(cache.stats().size, 2);
  assert.equal(cache.stats().evictions, 1);
});

test("async cache can decline degraded values", async () => {
  let reads = 0;
  const cache = createAsyncCache<string, { healthy: boolean }>({
    ttlMs: 100, maxEntries: 1, shouldCache: value => value.healthy,
  });
  await cache.get("snapshot", async () => { reads++; return { healthy: false }; });
  await cache.get("snapshot", async () => { reads++; return { healthy: true }; });
  await cache.get("snapshot", async () => { reads++; return { healthy: false }; });
  assert.equal(reads, 2);
});

test("async cache bounds distinct pending loads", async () => {
  const cache = createAsyncCache<string, number>({ ttlMs: 100, maxEntries: 2, maxPending: 1 });
  let release!: (value: number) => void;
  const first = cache.get("a", () => new Promise(resolve => { release = resolve; }));
  await assert.rejects(cache.get("b", async () => 2), /capacity/);
  release(1);
  assert.equal(await first, 1);
});
