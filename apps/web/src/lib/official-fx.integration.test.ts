import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '@price-radar/database';
import { getOfficialSubscriptionSnapshot, sortCollectedSubscriptionPrices, selectCollectedSubscriptionMinimum } from './public-pricing';
import { buildHomeBaseline } from './home-snapshot';
import type { query } from './database';

const adminUrl = process.env.POLICY_TEST_DATABASE_URL;
test('official FX uses each currency latest valid rate; fallback preserves dates and cannot revive stale floor', { skip: !adminUrl }, async () => {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const name = `fx_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`create database "${name}"`);
  const url = new URL(adminUrl!); url.pathname = `/${name}`;
  const handle = createDatabase(url.toString());
  const client = new pg.Pool({ connectionString: url.toString() });
  const read: typeof query = async <Row>(sql: string, values: readonly unknown[] = []) => (await client.query(sql, [...values])).rows as Row[];
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  try {
    await migrate(handle.db, { migrationsFolder: fileURLToPath(new URL('../../../../packages/database/drizzle/', import.meta.url)) });
    const rate = async (currency: string, offset: number, value: number) => (await client.query(
      "insert into exchange_rate_snapshots(base_currency,quote_currency,rate,source_url,source_name,effective_date) values($1,'CNY',$2,'https://example.com/fx','test',$3) returning id",
      [currency, value, day(offset)],
    )).rows[0].id as string;
    const old = await rate('USD', -8, 1);
    await rate('USD', -7, 5); await rate('USD', -2, 6.7);
    await rate('USD', -1, 0); await rate('USD', 0, -1); await rate('USD', 1, 9);
    const missing = await rate('KWD', -8, 1);
    await rate('EUR', -7, 7.4);
    const plan = (await client.query("insert into official_subscription_plans(vendor,plan_code,display_name,billing_period,official_url) values('xai','supergrok-monthly','SuperGrok','month','https://example.com') returning id")).rows[0].id;
    const verifiedAt = new Date();
    for (const [country,channel,currency,amount,estimate,fx] of [
      ['US','web','USD',30,30,old], ['KW','app_store','USD',30,31,old],
      ['DE','web','EUR',30,222,null], ['XX','web','KWD',1,1,missing], ['CN','web','CNY',250,250,null],
    ]) await client.query("insert into official_subscription_prices(plan_id,channel,country_code,currency,price_kind,amount,cny_estimate,exchange_rate_snapshot_id,raw_plan_name,evidence_url,evidence,evidence_hash,verified_at) values($1,$2,$3,$4,'exact',$5,$6,$7,'SuperGrok','https://example.com/price',$8,'test',$9)",
      [plan,channel,country,currency,amount,estimate,fx,{billingPeriod:'month',billingEvidenceUrl:'https://example.com/billing'},verifiedAt]);
    const snapshot = await getOfficialSubscriptionSnapshot(read);
    const usd = snapshot.prices.filter(p => p.currency === 'USD');
    assert.deepEqual(usd.map(p => p.cnyEstimate), ['201.000000','201.000000']);
    assert.ok(usd.every(p => p.exchangeRateDate === day(-2) && p.verifiedAt.getTime() === verifiedAt.getTime()));
    const eur = snapshot.prices.find(p => p.currency === 'EUR')!;
    assert.equal(eur.exchangeRateDate, day(-7)); assert.equal(eur.cnyEstimate, '222.000000');
    assert.equal(snapshot.prices.find(p => p.currency === 'CNY')!.cnyEstimate, '250.000000');
    const stale = snapshot.prices.find(p => p.currency === 'KWD')!;
    assert.equal(stale.exchangeRateDate, day(-8)); assert.equal(stale.eligibleForComparison, false);
    const floor = buildHomeBaseline(snapshot.prices, []).find(row => row.slug === "supergrok")!.officialFloor;
    assert.equal(floor?.cny, 201); assert.match(floor!.note, /美国 官网/);
    const sorted = sortCollectedSubscriptionPrices(snapshot.prices);
    assert.ok(sorted.every((p,i) => i === 0 || Number(sorted[i-1]!.cnyEstimate) <= Number(p.cnyEstimate)));
    assert.equal(Number(selectCollectedSubscriptionMinimum(sorted)!.cnyEstimate), Math.min(...sorted.map(p => Number(p.cnyEstimate))));
    // Execute the real other queries, failing only the FX read as a connection failure would.
    const failedRead: typeof query = async <Row>(sql: string, values: readonly unknown[] = []) => {
      if (sql.includes('distinct on (base_currency)')) throw new Error('simulated FX read failure');
      return await read(sql, values) as Row[];
    };
    const fallback = await getOfficialSubscriptionSnapshot(failedRead);
    assert.equal(fallback.available, true);
    assert.ok(fallback.prices.filter(p => p.currency === 'USD').every(p => p.exchangeRateDate === day(-8) && !p.eligibleForComparison));
    assert.equal(buildHomeBaseline(fallback.prices, []).find(row => row.slug === "supergrok")!.officialFloor, null);
    const stored = (await client.query('select cny_estimate,verified_at from official_subscription_prices where currency=\'USD\' order by cny_estimate')).rows;
    assert.deepEqual(stored.map(p => p.cny_estimate), ['30.000000','31.000000']);
    assert.ok(stored.every(p => p.verified_at.getTime() === verifiedAt.getTime()));
  } finally {
    await client.end(); await handle.close();
    await admin.query(`drop database "${name}"`); await admin.end();
  }
});
