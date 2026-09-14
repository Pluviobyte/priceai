import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialSnapshotCache } from "./official-snapshot-cache";

test("concurrent and repeat page visits share reads, then refresh after 30 seconds", async () => {
  let time = 0, reads = 0;
  const read = createOfficialSnapshotCache(async () => ({ available: true, checks: [], version: ++reads, verifiedAt: new Date(0) }), () => time);
  const visits = await Promise.all([read(), read(), read()]);
  assert.equal(reads, 1);
  assert.ok(visits.every(value => value.version === 1));
  time = 29_999;
  assert.equal((await read()).version, 1);
  assert.ok((await read()).verifiedAt instanceof Date);
  time = 30_000;
  assert.equal((await read()).version, 2);
});

test("failed or incomplete snapshots retry immediately", async () => {
  let reads = 0;
  const read = createOfficialSnapshotCache(async () => {
    reads++;
    if (reads === 1) throw new Error("offline");
    return { available: reads > 2, checks: reads > 3 ? [] : null };
  });
  await assert.rejects(read(), /offline/);
  assert.equal((await read()).available, false);
  assert.equal((await read()).checks, null);
  assert.deepEqual((await read()).checks, []);
  await read();
  assert.equal(reads, 4);
});
