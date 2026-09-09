import { promoteApprovedTrial } from './trial-promotion.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@price-radar/database';
import { InMemoryCollectorRegistry, PlatformDeferredError, WafChallengeError } from '@price-radar/collector-sdk';
import { PostgresRequestPolicy, platformKey } from './platform-policy.js';
import { recoverGrowthCandidates, measureCatalogGrowth } from './growth.js';
import { findDueSources, findVettableCandidates } from './scheduler.js';
import { vetNextCandidates } from './vetting.js';

// Explicit opt-in. Creates and drops its OWN database, never truncates caller data.
const adminUrl = process.env.POLICY_TEST_DATABASE_URL;
test('persistent platform policy and candidate scheduling (PostgreSQL)', { skip: !adminUrl }, async t => {
  const admin = new pg.Client({ connectionString: adminUrl });
  await admin.connect();
  const name = `price_policy_test_${randomUUID().replaceAll('-', '')}`;
  await admin.query(`create database "${name}"`);
  const url = new URL(adminUrl!); url.pathname = `/${name}`;
  const handle = createDatabase(url.toString());
  const db = handle.db;
  try {
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../../database/drizzle/', import.meta.url)) });
    const config = { intervalMs: 5, dailyLimit: 100, wafThreshold: 3, cooldownMs: 86400000 };
    const policy = new PostgresRequestPolicy(db, config);
    const signal = new AbortController().signal;
    const waf = () => { throw new WafChallengeError('wzyp.cn', 'test'); };
    await t.test('aliases share a persistent circuit, independent deployments remain available', async () => {
      assert.equal(platformKey('pay.ldxp.cn'), platformKey('wzyp.cn'));
      assert.notEqual(platformKey('catfk.com'), platformKey('wzyp.cn'));
      for (const host of ['wzyp.cn', 'pay.ldxp.cn', 'www.ldxp.cn']) await assert.rejects(policy.run(host, async () => waf(), signal), WafChallengeError);
      let calls = 0;
      const restarted = new PostgresRequestPolicy(db, config);
      await assert.rejects(restarted.run('wzyp.cn', async () => ++calls, signal), PlatformDeferredError);
      assert.equal(calls, 0);
      assert.equal(await restarted.run('catfk.com', async () => 21, signal), 21);
    });
    await t.test('two workers serialize requests and count every reservation', async () => {
      let active = 0, max = 0;
      const other = new PostgresRequestPolicy(db, config);
      const work = async () => { max = Math.max(max, ++active); await new Promise(r => setTimeout(r, 20)); active--; };
      await Promise.all([policy.run('catfk.com', work, signal), other.run('catfk.com', work, signal)]);
      assert.equal(max, 1);
      const { rows } = await db.execute(sql`select request_count from collector_platform_state where key='host:catfk.com'`);
      assert.equal(rows[0]!.request_count, 3);
    });
    await t.test('expired circuit allows one failed recovery, not a herd', async () => {
      await db.execute(sql`update collector_platform_state set blocked_until=now()-interval '1 second', next_request_at=null where key='ldxp_shop_api'`);
      let calls = 0;
      const recovery = () => policy.run('wzyp.cn', async () => { calls++; await new Promise(r => setTimeout(r, 20)); waf(); }, signal);
      const results = await Promise.allSettled([recovery(), recovery()]);
      assert.equal(calls, 1);
      assert.equal(results.filter(r => r.status === 'rejected').length, 2);
      await db.execute(sql`update collector_platform_state set blocked_until=now()-interval '1 second', next_request_at=null where key='ldxp_shop_api'`);
      await policy.run('wzyp.cn', async () => 'JSON', signal);
      const { rows } = await db.execute(sql`select waf_streak,blocked_until from collector_platform_state where key='ldxp_shop_api'`);
      assert.equal(rows[0]!.waf_streak, 0); assert.equal(rows[0]!.blocked_until, null);
    });
    await t.test('daily budget is shared and resets on UTC date rollover', async () => {
      const limited = new PostgresRequestPolicy(db, { ...config, dailyLimit: 1 });
      await limited.run('budget.example', async () => 1, signal);
      await assert.rejects(limited.run('budget.example', async () => assert.fail('must not request'), signal), /daily_budget/);
      await db.execute(sql`update collector_platform_state set budget_day=(now() at time zone 'UTC')::date-1 where key='host:budget.example'`);
      await limited.run('budget.example', async () => 2, signal);
    });
    await t.test('zero daily limit keeps requesting beyond the old quota and scheduling candidates', async () => {
      const unlimited = new PostgresRequestPolicy(db, { ...config, dailyLimit: 0 });
      await db.execute(sql`insert into collector_platform_state(key,budget_day,request_count)
        values('host:unlimited.example',(now() at time zone 'UTC')::date,3000)`);
      assert.equal(await unlimited.run('unlimited.example', async () => 'ok', signal), 'ok');
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind)
        values('https://unlimited.example/shop/a','directory')`);
      await db.execute(sql`update collector_platform_state set next_request_at=null where key='host:unlimited.example'`);
      const prior=process.env.SHOP_API_PLATFORM_DAILY_REQUESTS;
      process.env.SHOP_API_PLATFORM_DAILY_REQUESTS='0';
      try { assert.ok((await findVettableCandidates(db,1000)).some(r=>r.candidateUrl.includes('unlimited.example'))); }
      finally { if(prior===undefined) delete process.env.SHOP_API_PLATFORM_DAILY_REQUESTS; else process.env.SHOP_API_PLATFORM_DAILY_REQUESTS=prior; }
    });
    await t.test('oldest successful source goes first; a future retry remains deferred', async () => {
      const ids=[randomUUID(),randomUUID(),randomUUID()];
      await db.execute(sql`insert into sources(id,platform_kind,platform_merchant_id,canonical_entry_url,collector_kind,enabled,last_success_at,next_run_at)
        values(${ids[0]}::uuid,'test','fresh','https://fresh.example/','test',true,now()-interval '13 hours',now()-interval '4 hours'),
        (${ids[1]}::uuid,'test','stale','https://stale.example/','test',true,now()-interval '25 hours',now()-interval '1 hour'),
        (${ids[2]}::uuid,'test','retry','https://retry.example/','test',true,null,now()+interval '1 hour')`);
      assert.deepEqual((await findDueSources(db,new Date(),10)).map(r=>r.id),[ids[1],ids[0]]);
      const report=await measureCatalogGrowth(db);
      assert.equal(report.sources_success_24h,1);
      assert.equal(report.sources_missing_24h,2);
    });
    await t.test('Retry-After cooldown is persisted without marking WAF or issuing another request', async () => {
      await assert.rejects(policy.run('busy.example', async () => {
        throw new PlatformDeferredError(new Date(Date.now() + 120000), 'server_retry_after');
      }, signal), PlatformDeferredError);
      const { rows } = await db.execute(sql`select waf_streak,blocked_until,next_request_at>now()+interval '100 seconds' as delayed
        from collector_platform_state where key='host:busy.example'`);
      assert.equal(rows[0]!.waf_streak, 0);
      assert.equal(rows[0]!.blocked_until, null);
      assert.equal(rows[0]!.delayed, true);
      const aborted = AbortSignal.abort();
      await assert.rejects(policy.run('busy.example', async () => assert.fail('must not send'), aborted));
    });
    await t.test('hundreds of high-priority blocked candidates cannot crowd out reachable platforms', async () => {
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,priority)
        select 'https://wzyp.cn/shop/'||n, 'directory', 99 from generate_series(1,783) n`);
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,priority)
        select 'https://catfk.com/shop/'||n, 'directory', 10 from generate_series(1,65) n`);
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,priority)
        values('https://talkai.cyou/shop/a','directory',1),('https://kutg.com/shop/a','directory',1)`);
      await db.execute(sql`update collector_platform_state set blocked_until=now()+interval '1 day' where key='ldxp_shop_api'`);
      const queue = await findVettableCandidates(db, 3);
      assert.deepEqual(new Set(queue.map(r => new URL(r.candidateUrl).hostname)), new Set(['catfk.com', 'talkai.cyou', 'kutg.com']));
      await db.execute(sql`update collector_platform_state set last_served_at=now() where key='host:catfk.com'`);
      const next = await findVettableCandidates(db, 1);
      assert.notEqual(new URL(next[0]!.candidateUrl).hostname, 'catfk.com');
    });
    await t.test('automatic WAF reviews migrate with audit; unrelated review is preserved; parked candidates recover', async () => {
      const evidence = { version: 'vetting-2026-09-08.2', attempts: 3, reasons: ['source_access_challenge:test','max_attempts_reached'] };
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,status,vetted_at,vetting_result)
        values('https://legacy.example/shop/a','directory','review',now(),${JSON.stringify(evidence)}::jsonb),
        ('https://legacy.example/shop/b','directory','review',now(),${JSON.stringify(evidence)}::jsonb),
        ('https://legacy.example/shop/c','directory','review',now(),${JSON.stringify(evidence)}::jsonb),
        ('https://manual.example/','directory','review',now(),'{}'::jsonb)`);
      const migration = await readFile(new URL('../../database/drizzle/0020_strong_monster_badoon.sql', import.meta.url), 'utf8');
      await db.execute(sql.raw(migration.slice(migration.indexOf('--> statement-breakpoint'))));
      const { rows } = await db.execute(sql`select candidate_url,status from source_candidates where candidate_url like '%example%' order by candidate_url`);
      assert.equal(rows.find(r => String(r.candidate_url).includes('legacy'))!.status, 'blocked_egress');
      assert.equal(rows.find(r => String(r.candidate_url).includes('manual'))!.status, 'review');
      await db.execute(sql`update source_candidates set next_vet_at=now()-interval '1 second' where candidate_url='https://legacy.example/shop/a'`);
      const gate = await db.execute(sql`select waf_streak,blocked_until>now() as blocked from collector_platform_state where key='host:legacy.example'`);
      assert.equal(gate.rows[0]!.waf_streak, 3);
      assert.equal(gate.rows[0]!.blocked, true);
      await db.execute(sql`update collector_platform_state set blocked_until=now()-interval '1 second' where key='host:legacy.example'`);
      const aborted = AbortSignal.abort();
      await vetNextCandidates(db, new InMemoryCollectorRegistry(), { signal: aborted, context: { comparables: new Map(), otherCatalogs: [] } });
      const recovered = await db.execute(sql`select status from source_candidates where candidate_url='https://legacy.example/shop/a'`);
      assert.equal(recovered.rows[0]!.status, 'pending');
    });
    await t.test('growth recovery is one-time and more than 30 daily attempts do not stop admission', async () => {
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,status,platform_kind,vetting_result)
        values('https://recovery.example/','directory','rejected','kami','{"version":"vetting-old","reasons":["no_ai_relevant_items"]}'::jsonb)`);
      assert.equal((await recoverGrowthCandidates(db)).requeued,1);
      assert.equal((await recoverGrowthCandidates(db)).requeued,0);
      assert.equal((await measureCatalogGrowth(db))?.valid_offers,0);
      await db.execute(sql`update collector_platform_state set blocked_until=null,lease_until=null,next_request_at=null,request_count=0 where key='ldxp_shop_api'`);
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,status,platform_kind,vetted_at,vetting_result)
        select 'https://wzyp.cn/shop/daily-'||n,'directory','review','ldxp_shop_api',now(),'{"version":"vetting-2026-09-09.1"}'::jsonb from generate_series(1,30) n`);
      await db.execute(sql`insert into source_candidates(candidate_url,discovery_kind,status,platform_kind) values('https://wzyp.cn/shop/after-daily-cap','directory','pending','ldxp_shop_api')`);
      const queue = await findVettableCandidates(db,1000);
      assert.ok(queue.some(row=>row.candidateUrl.includes('wzyp.cn')));
      assert.ok(queue.some(row=>row.candidateUrl.includes('recovery.example')));
    });
    await t.test('only complete source-owned approved trials can become live snapshots', async () => {
      const sourceId=randomUUID(),otherId=randomUUID(),runId=randomUUID();
      await db.execute(sql`insert into sources(id,platform_kind,platform_merchant_id,canonical_entry_url,collector_kind)
        values(${sourceId}::uuid,'test','trial-owner','https://trial.example/','test'),
          (${otherId}::uuid,'test','other-owner','https://other.example/','test')`);
      await db.execute(sql`insert into crawl_runs(id,source_id,collector_kind,collector_version,status,complete_snapshot,finished_at,expected_total)
        values(${runId}::uuid,${sourceId}::uuid,'test','1','partial',false,now(),1)`);
      await assert.rejects(promoteApprovedTrial(db,sourceId,runId,new Date()),/not_complete/);
      await db.execute(sql`update crawl_runs set status='success',complete_snapshot=true where id=${runId}::uuid`);
      await assert.rejects(promoteApprovedTrial(db,otherId,runId,new Date()),/source_mismatch/);
      await promoteApprovedTrial(db,sourceId,runId,new Date(Date.now()+43200000));
      const live=await db.execute(sql`select latest_complete_run_id,enabled,health_status from sources where id=${sourceId}::uuid`);
      assert.equal(live.rows[0]!.latest_complete_run_id,runId);assert.equal(live.rows[0]!.enabled,true);assert.equal(live.rows[0]!.health_status,'healthy');
    });
  } finally {
    await handle.close();
    await admin.query(`drop database "${name}" with (force)`);
    await admin.end();
  }
});
