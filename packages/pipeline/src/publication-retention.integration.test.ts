import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@price-radar/database';
import { publishLatestSnapshots } from './publish.js';
import { rollbackPublication, storePublicGenerationSnapshot } from './generations.js';
import { seedCanonicalProducts } from './catalog-products.js';
import { pruneSnapshotBatch } from './snapshot-retention.js';

const adminUrl=process.env.POLICY_TEST_DATABASE_URL;
test('publication deduplication preserves observations, history, changes and rollback safety',{skip:!adminUrl},async t=>{
  const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
  const name=`price_retention_test_${randomUUID().replaceAll('-','')}`;
  await admin.query(`create database "${name}"`);
  const url=new URL(adminUrl!);url.pathname=`/${name}`;
  const handle=createDatabase(url.toString());const db=handle.db;
  const source=randomUUID(),run=randomUUID(),merchant=randomUUID();
  const at=new Date('2026-09-16T10:00:00Z');
  try{
    await migrate(db,{migrationsFolder:fileURLToPath(new URL('../../database/drizzle/',import.meta.url))});
    await seedCanonicalProducts(db);
    await db.execute(sql`insert into merchants(id,name,slug) values(${merchant}::uuid,'Test merchant','test-merchant')`);
    await db.execute(sql`insert into sources(id,merchant_id,platform_kind,platform_merchant_id,canonical_entry_url,collector_kind,enabled)
      values(${source}::uuid,${merchant}::uuid,'test','test','https://example.com/shop','json_feed',true)`);
    await db.execute(sql`insert into crawl_runs(id,source_id,collector_kind,collector_version,status,complete_snapshot)
      values(${run}::uuid,${source}::uuid,'json_feed','1','success',true)`);
    await db.execute(sql`update sources set latest_complete_run_id=${run}::uuid where id=${source}::uuid`);
    await db.execute(sql`insert into raw_offer_snapshots(crawl_run_id,source_id,source_item_id,raw_title,raw_price_text,raw_price_numeric,currency,stock_count,stock_state_hint,product_url,captured_at,raw_payload_hash)
      values(${run}::uuid,${source}::uuid,'one','ChatGPT Plus 独享账号 月付','100','100','CNY',10,'in_stock','https://example.com/item',${at},'test-payload-hash-0001')`);
    const first=await publishLatestSnapshots(db,{now:at});
    assert.equal(first.unchanged,false);assert.equal(first.offerCount,1);
    const later=new Date(at.getTime()+60000);
    await db.execute(sql`update raw_offer_snapshots set captured_at=${later}`);
    await t.test('same business content refreshes live clocks without adding history',async()=>{
      const second=await publishLatestSnapshots(db,{now:later});
      assert.equal(second.unchanged,true);assert.equal(second.generationId,first.generationId);
      const rows=await db.execute(sql`select (select count(*)::int from publish_generations) as generations,
        (select count(*)::int from published_offer_snapshots) as snapshots,
        (select offer_verified_at from offers limit 1) as live_time,
        (select offer_verified_at from published_offer_snapshots limit 1) as historical_time`);
      assert.equal(rows.rows[0]?.generations,1);assert.equal(rows.rows[0]?.snapshots,1);
      assert.equal(new Date(String(rows.rows[0]?.live_time)).getTime(),later.getTime());
      assert.equal(new Date(String(rows.rows[0]?.historical_time)).getTime(),at.getTime());
    });
    await t.test('freshness transition alone publishes a version',async()=>{
      const changed=await publishLatestSnapshots(db,{now:new Date(later.getTime()+7*3600000)});
      assert.equal(changed.unchanged,false);assert.notEqual(changed.generationId,first.generationId);
    });
    await t.test('price change publishes and persists comparison without modifying old snapshots',async()=>{
      await db.execute(sql`update raw_offer_snapshots set raw_price_numeric='110',raw_price_text='110'`);
      const changed=await publishLatestSnapshots(db,{now:new Date(later.getTime()+7*3600000)});
      const row=(await db.execute(sql`select added_count,removed_count,changed_count,content_hash,manifest_hash from publish_generations where id=${changed.generationId}::uuid`)).rows[0]!;
      assert.equal(row.changed_count,1);assert.equal(row.added_count,0);assert.equal(row.removed_count,0);
      assert.ok(row.content_hash);assert.equal(row.manifest_hash,null);
      const old=(await db.execute(sql`select price from published_offer_snapshots where publish_generation_id=${first.generationId}::uuid`)).rows[0]!;
      assert.equal(Number(old.price),100);
    });
    await t.test('retained rollback succeeds and dedup compares against the restored version',async()=>{
      const result=await rollbackPublication(db,{targetGenerationId:first.generationId,actorId:'test',reason:'integration test'});
      assert.equal(result.restoredOffers,1);
      const next=await publishLatestSnapshots(db,{now:later});assert.equal(next.unchanged,false);
    });
    await t.test('object manifest hash stays distinct from content hash and is not overwritten on reuse',async()=>{
      let writes=0;
      const store={putJson:async(key:string,value:unknown)=>{
        writes++;const body=JSON.stringify(value);
        return {uri:`s3://test/${key}`,sha256:createHash('sha256').update(body).digest('hex'),size:body.length};
      }};
      const stored=await storePublicGenerationSnapshot(db,store,first.generationId);
      const reused=await storePublicGenerationSnapshot(db,store,first.generationId);
      assert.equal(writes,1);assert.equal(stored.sha256,reused.sha256);
      const record=(await db.execute(sql`select content_hash,manifest_hash from publish_generations where id=${first.generationId}::uuid`)).rows[0]!;
      assert.equal(record.manifest_hash,stored.sha256);assert.notEqual(record.content_hash,record.manifest_hash);
    });
    await t.test('pruning state blocks rollback even while snapshot rows remain',async()=>{
      await db.execute(sql`update publish_generations set snapshot_state='pruning' where id=${first.generationId}::uuid`);
      await assert.rejects(rollbackPublication(db,{targetGenerationId:first.generationId,actorId:'test',reason:'must reject'}),/generation_snapshot_expired/);
    });
    await t.test('publication does not queue behind retention or rollback lock',async()=>{
      const blocker=new pg.Client({connectionString:url.toString()});await blocker.connect();
      try{await blocker.query('begin');await blocker.query('select pg_advisory_xact_lock(718231,1)');
        await assert.rejects(publishLatestSnapshots(db,{now:later}),/publication_busy/);
      }finally{await blocker.query('rollback');await blocker.end();}
    });
    await t.test('bounded deletion resumes, audits, rejects protected versions and cannot race publication',async()=>{
      const connection=new pg.Client({connectionString:url.toString()});await connection.connect();
      const old=randomUUID();const policy={denseHours:24,checkpointDays:7,maxRetainedRows:100000};
      try{
        await connection.query(`insert into publish_generations(id,status,channel,generated_at,offer_count)
          values($1,'superseded','card_prices',now()-interval '30 days',450)`,[old]);
        // Clone a real snapshot into this disposable test database only.
        await connection.query(`insert into published_offer_snapshots
          select (jsonb_populate_record(null::published_offer_snapshots,to_jsonb(s)||jsonb_build_object(
            'id',gen_random_uuid(),'publish_generation_id',$1::text,'source_item_id','old-'||n))).*
          from published_offer_snapshots s cross join generate_series(1,450) n
          where s.publish_generation_id=$2`,[old,first.generationId]);
        const rowLocker=new pg.Client({connectionString:url.toString()});await rowLocker.connect();
        try{
          await rowLocker.query('begin');await rowLocker.query('select id from publish_generations where id=$1 for update',[old]);
          await assert.rejects(pruneSnapshotBatch(connection,policy,old),(error:unknown)=>(error as {code:string}).code==='55P03');
        }finally{await rowLocker.query('rollback');await rowLocker.end();}
        assert.equal((await connection.query('select snapshot_state from publish_generations where id=$1',[old])).rows[0].snapshot_state,'retained');
        assert.deepEqual(await pruneSnapshotBatch(connection,policy,old),{deleted:200,complete:false});
        assert.equal((await connection.query('select snapshot_state from publish_generations where id=$1',[old])).rows[0].snapshot_state,'pruning');
        await assert.rejects(rollbackPublication(db,{targetGenerationId:old,actorId:'test',reason:'partial must reject'}),/generation_snapshot_expired/);
        await connection.query('update publish_generations set snapshot_pinned=true where id=$1',[old]);
        await assert.rejects(pruneSnapshotBatch(connection,policy,old),/protected_or_complete/);
        await connection.query('update publish_generations set snapshot_pinned=false where id=$1',[old]);
        assert.deepEqual(await pruneSnapshotBatch(connection,policy,old),{deleted:200,complete:false});
        assert.deepEqual(await pruneSnapshotBatch(connection,policy,old),{deleted:50,complete:true});
        assert.equal((await connection.query('select snapshot_state from publish_generations where id=$1',[old])).rows[0].snapshot_state,'pruned');
        assert.equal((await connection.query("select count(*)::int n from audit_logs where action='publication.snapshot_prune' and target_id=$1",[old])).rows[0].n,3);
        await assert.rejects(pruneSnapshotBatch(connection,policy,old),/protected_or_complete/);
        const current=(await connection.query('select current_generation_id from publication_channels')).rows[0].current_generation_id;
        await assert.rejects(pruneSnapshotBatch(connection,policy,current),/protected_or_complete/);
        const blocker=new pg.Client({connectionString:url.toString()});await blocker.connect();
        try{await blocker.query('begin');await blocker.query('select pg_advisory_xact_lock(718231,1)');
          await assert.rejects(pruneSnapshotBatch(connection,policy,old),/publication_busy_paused/);
        }finally{await blocker.query('rollback');await blocker.end();}
      }finally{await connection.end();}
    });
    await t.test('maintenance CLI defaults to metadata-only preview',async()=>{
      const directory=await mkdtemp(join(tmpdir(),'price-retention-policy-'));
      try{
        const policyFile=join(directory,'policy.json');
        await writeFile(policyFile,JSON.stringify({denseHours:24,checkpointDays:7,maxRetainedRows:100000}));
        const before=await db.execute(sql`select count(*)::int n from published_offer_snapshots`);
        const {stdout}=await promisify(execFile)(process.execPath,['--import','tsx',fileURLToPath(new URL('../../../scripts/snapshot-retention.mts',import.meta.url)),'--policy',policyFile],
          {env:{...process.env,MAINTENANCE_DATABASE_URL:url.toString()}});
        const report=JSON.parse(stdout);assert.equal(report.mode,'preview');assert.ok(report.storage.heap_bytes);
        assert.deepEqual((await db.execute(sql`select count(*)::int n from published_offer_snapshots`)).rows,before.rows);
      }finally{await rm(directory,{recursive:true,force:true});}
    });
  }finally{await handle.close();await admin.query(`drop database "${name}"`);await admin.end();}
});
