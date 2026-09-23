import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { createDatabase } from '@price-radar/database';
import { seedVerifiedOfficialApiPrices } from '@price-radar/price-channels';
import { seedVerifiedSubscriptionPrices, verifyOfficialWebPrices } from '@price-radar/price-channels/subscriptions';
import { runTransitSweep, TRANSIT_CATALOG_LOCK } from './transit-runner.js';

const url = process.env.PRICEAI_RECOVERY_TEST_DATABASE_URL;
test('recovery preserves evidence freshness and serializes transit refreshes', { skip: !url }, async () => {
  const database = createDatabase(url!);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  const originalFetch = globalThis.fetch;
  try {
    await seedVerifiedOfficialApiPrices(database.db);
    const before = (await client.query('select id,verified_at from official_api_prices order by id')).rows;
    assert.ok(before.length > 0);
    assert.ok(before.every(row => row.verified_at.toISOString().startsWith('2026-09-03')));
    await client.query("update official_api_prices set input_price=123,verified_at='2026-09-22' where id=$1", [before[0].id]);
    await seedVerifiedOfficialApiPrices(database.db);
    const preserved = (await client.query('select input_price,verified_at from official_api_prices where id=$1', [before[0].id])).rows[0];
    assert.equal(Number(preserved.input_price), 123);
    assert.equal(preserved.verified_at.toISOString(), '2026-09-22T00:00:00.000Z');

    await seedVerifiedSubscriptionPrices(database.db);
    globalThis.fetch = async () => new Response('unavailable', { status: 404 });
    let calls = 0;
    const browser = async (urls: readonly string[]) => {
      calls++;
      return urls.map(url => ({ url, finalUrl: url, status: 200, text: 'SuperGrok', html: '<h2>SuperGrok</h2><p>$30/month</p><h2>SuperGrok Plus</h2><p>$100/month</p>' }));
    };
    const verified = new Date('2026-09-23T01:00:00Z');
    assert.equal(await verifyOfficialWebPrices(database.db, verified, browser), 2);
    assert.equal(calls, 1);
    await verifyOfficialWebPrices(database.db, new Date('2026-09-23T02:00:00Z'), async urls => urls.map(url => ({ url, finalUrl: url, status: 403, text: '', html: '' })));
    const prices = (await client.query("select verified_at from official_subscription_prices p join official_subscription_plans pl on pl.id=p.plan_id where pl.vendor='xai' and p.channel='web'")).rows;
    assert.ok(prices.length >= 2);
    assert.ok(prices.every(row => row.verified_at <= verified));

    await client.query('select pg_advisory_lock($1)', [TRANSIT_CATALOG_LOCK]);
    assert.equal((await runTransitSweep(url!)).reason, 'already_running');
    await client.query('select pg_advisory_unlock($1)', [TRANSIT_CATALOG_LOCK]);
    // Production holds the channel lock continuously; transit must still run.
    await client.query('select pg_advisory_lock(7410319)');
    let requests = 0;
    globalThis.fetch = async () => {
      requests++;
      return Response.json({ data: [{ id: 'priced', pricing: { prompt: '0.0000003', completion: '0' } }, { id: 'unsupported', pricing: { input: null, output: null } }] });
    };
    const result = await runTransitSweep(url!);
    assert.equal(result.status, 'success');
    assert.equal(requests, 2);
    assert.ok(Object.values(result.providers!).every(provider => provider.prices === 1 && provider.skipped === 1));
    assert.equal((await runTransitSweep(url!)).reason, 'not_due');
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await client.end();
    await database.close();
  }
});
