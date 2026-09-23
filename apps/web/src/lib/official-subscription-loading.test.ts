import assert from "node:assert/strict";
import test from "node:test";
import { getOfficialSubscriptionSnapshot } from "./public-pricing";
import type { query } from "./database";

const isRateQuery = (sql: string) => sql.includes("distinct on (base_currency)");

test("official page starts prices, checks and current rates together and reads checks only once", async () => {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const pending: Array<() => void> = [];
  const read: typeof query = async <Row>(sql: string, values: readonly unknown[] = []): Promise<Row[]> => {
    calls.push({ sql, values });
    await new Promise<void>(resolve => pending.push(resolve));
    return [];
  };
  const result = getOfficialSubscriptionSnapshot(read);
  assert.equal(calls.length, 3, "all three independent queries must start before any resolves");
  assert.equal(calls.filter(call => call.sql.includes("from official_subscription_checks")).length, 1);
  // The same window the collector converts with: the newest rate dated within the past seven days.
  const rateCall = calls.find(call => isRateQuery(call.sql));
  const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  assert.deepEqual(rateCall?.values, [day(7), day(0)]);
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

// Kuwait's App Store charges USD; this record was swept while an older USD rate was current.
const storedKuwait = {
  id: "kw-app", vendor: "xai", plan_code: "supergrok-monthly", plan_name: "SuperGrok", billing_period: "month",
  channel: "app_store", country_code: "KW", currency: "USD", price_kind: "exact", amount: "30.000000",
  lower_amount: null, upper_amount: null, cny_estimate: "200.860000", raw_plan_name: "SuperGrok", app_id: "6670324846",
  evidence_url: "https://apps.apple.com/kw/app/id6670324846", evidence: {}, verified_at: new Date("2026-09-22T01:00:00Z"),
  exchange_rate_date: "2026-09-16", exchange_rate_url: "https://ecb.example/old", history_count: "1",
};

test("prices are shown at the current rate of their currency", async () => {
  const read: typeof query = async <Row>(sql: string): Promise<Row[]> => {
    if (sql.includes("from official_subscription_prices")) return [storedKuwait] as Row[];
    if (isRateQuery(sql)) return [{ base_currency: "USD", rate: "6.7000785000", effective_date: "2026-09-22", source_url: "https://ecb.example/new" }] as Row[];
    return [];
  };
  const [price] = (await getOfficialSubscriptionSnapshot(read)).prices;
  assert.equal(price?.cnyEstimate, "201.002355");
  assert.equal(price?.exchangeRateDate, "2026-09-22");
  assert.equal(price?.exchangeRateUrl, "https://ecb.example/new");
  assert.equal(price?.amount, "30.000000");
  assert.equal(price?.verifiedAt.toISOString(), "2026-09-22T01:00:00.000Z");
});

test("a failed current-rate query keeps prices available at their stored, dated conversions", async () => {
  const logged: unknown[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args[0]); };
  try {
    const read: typeof query = async <Row>(sql: string): Promise<Row[]> => {
      if (sql.includes("from official_subscription_prices")) return [storedKuwait] as Row[];
      if (isRateQuery(sql)) throw new Error("rates unavailable");
      return [];
    };
    const snapshot = await getOfficialSubscriptionSnapshot(read);
    assert.equal(snapshot.available, true);
    assert.equal(snapshot.prices[0]?.cnyEstimate, "200.860000");
    assert.equal(snapshot.prices[0]?.exchangeRateDate, "2026-09-16");
    assert.deepEqual(logged, ["official_current_cny_rates_failed"]);
  } finally {
    console.error = original;
  }
});
