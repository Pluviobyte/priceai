import assert from "node:assert/strict";
import test from "node:test";
import { getOfficialSubscriptionSnapshot } from "./public-pricing";
import type { query } from "./database";

test("official page starts prices and checks together and reads checks only once", async () => {
  const calls: string[] = [];
  const pending: Array<() => void> = [];
  const read: typeof query = async <Row>(sql: string): Promise<Row[]> => {
    calls.push(sql);
    await new Promise<void>(resolve => pending.push(resolve));
    return [];
  };
  const result = getOfficialSubscriptionSnapshot(read);
  assert.equal(calls.length, 2, "both independent queries must start before either resolves");
  assert.equal(calls.filter(sql => sql.includes("from official_subscription_checks")).length, 1);
  pending.forEach(resolve => resolve());
  assert.deepEqual(await result, {prices: [], checks: [], available: true});
});

test("failed price query preserves checks and failure status", async () => {
  const read: typeof query = async <Row>(sql: string): Promise<Row[]> => {
    if (sql.includes("from official_subscription_prices")) throw new Error("price query unavailable");
    return [];
  };
  assert.deepEqual(await getOfficialSubscriptionSnapshot(read), {prices: [], checks: [], available: false});
});

test("failed checks query is handled without silently treating prices as verified", async () => {
  const read: typeof query = async <Row>(sql: string): Promise<Row[]> => {
    if (sql.includes("from official_subscription_checks")) throw new Error("checks unavailable");
    return [];
  };
  assert.deepEqual(await getOfficialSubscriptionSnapshot(read), {prices: [], checks: null, available: false});
});
