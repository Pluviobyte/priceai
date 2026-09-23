import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialSnapshotCache } from "./official-snapshot-cache";

test("visits share one read, then get the last snapshot at once while it refreshes in the background", async () => {
  let time = 0, reads = 0;
  const read = createOfficialSnapshotCache(async () => ({ available: true, checks: [], version: ++reads, verifiedAt: new Date(0) }), () => time);
  const visits = await Promise.all([read(), read(), read()]);
  assert.equal(reads, 1);
  assert.ok(visits.every(value => value.version === 1));
  time = 5 * 60_000 - 1;
  assert.equal((await read()).version, 1);
  assert.ok((await read()).verifiedAt instanceof Date);
  assert.equal(reads, 1);
  time = 5 * 60_000;
  assert.equal((await read()).version, 1, "an expired snapshot is still answered at once");
  assert.equal(reads, 2, "while a single refresh starts");
  assert.equal((await read()).version, 2);
});

test("a failed refresh keeps the last good snapshot until it is too old to serve", async () => {
  let time = 0, reads = 0;
  const read = createOfficialSnapshotCache(async () => {
    reads++;
    if (reads > 1) throw new Error("offline");
    return { available: true, checks: [], version: reads };
  }, () => time, 1_000, 10_000);
  assert.equal((await read()).version, 1);
  time = 5_000;
  assert.equal((await read()).version, 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await read()).version, 1, "the failed refresh did not discard it");
  time = 10_000;
  await assert.rejects(read(), /offline/);
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
