import assert from "node:assert/strict";
import test from "node:test";
import { createAsyncCache, createStaleWhileRevalidate } from "./async-cache";
import { filterKey, readCachedChannelCatalog, type CatalogReadDependencies } from "./catalog-read-cache";
import { parseChannelFilters } from "./channel-filters";
import type { ChannelCatalog } from "./channel-catalog";
import type { ChannelReadModel } from "./channel-read-model";

function caches(): Pick<CatalogReadDependencies, "modelCache" | "resultCache"> {
  return {
    modelCache: createAsyncCache<string, ChannelReadModel>({ ttlMs: 1_000, maxEntries: 2 }),
    resultCache: createAsyncCache<string, ChannelCatalog>({ ttlMs: 1_000, maxEntries: 4 }),
  };
}

test("catalog cache keys are stable and include every normalized filter", () => {
  const first = parseChannelFilters({ q: "plus", page: "2", stock: "available", mode: "recharge" });
  const same = { ...first };
  const otherPage = { ...first, page: 3 };
  const otherLayout = { ...first, layout: first.layout === "cards" ? "table" as const : "cards" as const };
  assert.equal(filterKey(first), filterKey(same));
  assert.equal(filterKey(first), filterKey(otherLayout));
  assert.notEqual(filterKey(first), filterKey(otherPage));
  assert.match(filterKey(first), /available/);
});

test("catalog reads retry a publication switch without storing a model under the wrong generation", async () => {
  const pointers = ["a", "b", "b", "b"];
  const loaded: Array<string | null> = [];
  const dependencies: CatalogReadDependencies = {
    ...caches(),
    getPointer: async () => ({ generation_id: pointers.shift() ?? "b" }),
    loadModel: async generationId => { loaded.push(generationId); return { generationId, offers: [] }; },
  };
  const result = await readCachedChannelCatalog(parseChannelFilters({}), dependencies);
  assert.equal(result.total, 0);
  assert.deepEqual(loaded, ["a", "b"]);
  assert.equal(dependencies.modelCache.stats().size, 2);
});

test("catalog model failures retry and concurrent cold reads share one exact-generation load", async () => {
  const shared = caches();
  let loads = 0;
  const failing: CatalogReadDependencies = {
    ...shared,
    getPointer: async () => ({ generation_id: "a" }),
    loadModel: async generationId => {
      loads++;
      if (loads === 1) throw new Error("temporary");
      return { generationId, offers: [] };
    },
  };
  await assert.rejects(readCachedChannelCatalog(parseChannelFilters({}), failing), /temporary/);
  assert.equal((await readCachedChannelCatalog(parseChannelFilters({}), failing)).total, 0);
  assert.equal(loads, 2);

  const concurrent = caches();
  let release!: () => void;
  let concurrentLoads = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const dependencies: CatalogReadDependencies = {
    ...concurrent,
    getPointer: async () => ({ generation_id: "b" }),
    loadModel: async generationId => { concurrentLoads++; await gate; return { generationId, offers: [] }; },
  };
  const first = readCachedChannelCatalog(parseChannelFilters({}), dependencies);
  const second = readCachedChannelCatalog(parseChannelFilters({}), dependencies);
  await Promise.resolve();
  assert.equal(concurrentLoads, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(dependencies.modelCache.stats().coalesced, 1);
});

test("catalog answers a new publication from the previous model while it loads", async () => {
  const shared = caches();
  const modelStaleFor = createStaleWhileRevalidate(shared.modelCache, { maxStaleMs: 60_000 });
  const filters = parseChannelFilters({});
  let pointer = "a", release!: () => void;
  const loaded: Array<string | null> = [];
  const dependencies: CatalogReadDependencies = {
    ...shared,
    modelStaleFor,
    getPointer: async () => ({ generation_id: pointer }),
    loadModel: async generationId => {
      loaded.push(generationId);
      if (generationId === "b") await new Promise<void>(resolve => { release = resolve; });
      return { generationId, offers: [] };
    },
  };
  await readCachedChannelCatalog(filters, dependencies);
  pointer = "b";
  await readCachedChannelCatalog(filters, dependencies);
  assert.equal(shared.resultCache.peek(`b:${filterKey(filters)}`), undefined, "b's view was not built yet");
  assert.equal(modelStaleFor.stats().staleServed, 1);
  release();
  await new Promise(resolve => setImmediate(resolve));
  await readCachedChannelCatalog(filters, dependencies);
  assert.notEqual(shared.resultCache.peek(`b:${filterKey(filters)}`), undefined);
  assert.deepEqual(loaded, ["a", "b"]);
});
