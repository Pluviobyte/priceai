import assert from "node:assert/strict";
import test from "node:test";
import { Client, type QueryResultRow } from "pg";
import { readOfferPage } from "../src/lib/public-catalog";

test("detail pagination reads bounded pages with stable ties and full counts", { skip: !process.env.CHANNEL_TEST_DATABASE_URL }, async () => {
  const db = new Client({ connectionString: process.env.CHANNEL_TEST_DATABASE_URL });
  await db.connect();
  try {
    await db.query("create temp table detail_fixture(id text, price numeric, verified_at timestamptz)");
    await db.query("insert into detail_fixture select i::text, 10, now() from generate_series(1,75) i");
    let calls = 0;
    const read = async <R extends QueryResultRow>(sql: string, values: readonly unknown[] = []) => {
      calls++; return (await db.query<R>(sql, [...values])).rows;
    };
    const sql = "select o.* from detail_fixture o where o.price >= $1";
    const first = await readOfferPage(sql,"o.price",[10],1,read);
    assert.equal(calls,1); assert.equal(first.total,75); assert.equal(first.offers.length,30);
    assert.ok(first.offers[0]?.verifiedAt instanceof Date);
    const second = await readOfferPage(sql,"o.price",[10],2,read);
    assert.equal(second.offers.length,30);
    assert.equal(second.offers.some(row=>first.offers.some(other=>other.id===row.id)),false);
    const last = await readOfferPage(sql,"o.price",[10],999,read);
    assert.equal(last.page,3); assert.equal(last.offers.length,15);
    const empty = await readOfferPage(sql,"o.price",[11],999,read);
    assert.equal(empty.total,0); assert.equal(empty.page,1); assert.deepEqual(empty.offers,[]);
    assert.equal((await readOfferPage(sql,"o.price",[10],NaN,read)).page,1);
  } finally { await db.end(); }
});
