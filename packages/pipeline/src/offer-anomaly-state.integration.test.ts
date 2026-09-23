import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { createDatabase } from '@price-radar/database';
import { publishLatestSnapshots } from './publish.js';
import { seedCanonicalProducts } from './catalog-products.js';

const adminUrl=process.env.POLICY_TEST_DATABASE_URL;
test('publication reuses anomalies across snapshots, preserves ignores and bounds repeated writes', {skip:!adminUrl}, async()=>{
  const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
  const name=`anomaly_test_${randomUUID().replaceAll('-','')}`;await admin.query(`create database "${name}"`);
  const url=new URL(adminUrl!);url.pathname=`/${name}`;
  const handle=createDatabase(url.toString());const db=handle.db;
  const source=randomUUID();const at=new Date();
  async function snapshot(title:string,goodsType:string|null=null){
    const run=randomUUID(),raw=randomUUID();
    await db.execute(sql`insert into crawl_runs(id,source_id,collector_kind,collector_version,status,complete_snapshot)
      values(${run}::uuid,${source}::uuid,'json_feed','test','success',true)`);
    await db.execute(sql`insert into raw_offer_snapshots(id,crawl_run_id,source_id,source_item_id,raw_title,raw_price_text,raw_price_numeric,currency,stock_state_hint,product_url,captured_at,raw_payload_hash,goods_type)
      values(${raw}::uuid,${run}::uuid,${source}::uuid,'one',${title},'100',100,'CNY','in_stock','https://example.com/one',${at},${raw},${goodsType})`);
    if(goodsType)await db.execute(sql`insert into source_catalog_type_snapshots(source_id,goods_type,run_id,checked_at,item_count)
      values(${source}::uuid,${goodsType},${run}::uuid,${at},1) on conflict(source_id,goods_type) do update set run_id=excluded.run_id`);
    else await db.execute(sql`update sources set latest_complete_run_id=${run}::uuid where id=${source}::uuid`);
    return raw;
  }
  try {
    await migrate(db,{migrationsFolder:fileURLToPath(new URL('../../database/drizzle/',import.meta.url))});
    await seedCanonicalProducts(db);
    await db.execute(sql`insert into sources(id,platform_kind,platform_merchant_id,canonical_entry_url,collector_kind,enabled)
      values(${source}::uuid,'test','one','https://example.com','json_feed',true)`);
    await snapshot('一块普通石头');await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    const first=(await db.execute(sql`select * from offer_anomalies where kind='unclassified_product'`)).rows[0]!;
    assert.ok(first);
    for(let i=0;i<4;i++){await snapshot('一块普通石头');await publishLatestSnapshots(db,{now:at,allowEmpty:true});}
    const reused=(await db.execute(sql`select * from offer_anomalies where kind='unclassified_product'`)).rows;
    assert.equal(reused.length,1);assert.equal(reused[0]!.id,first.id);
    const xmin=(await db.execute(sql`select xmin::text from offer_anomalies where id=${first.id}::uuid`)).rows[0]!.xmin;
    await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    assert.equal((await db.execute(sql`select xmin::text from offer_anomalies where id=${first.id}::uuid`)).rows[0]!.xmin,xmin);
    await snapshot('ChatGPT Plus 独享账号 月付');await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    assert.equal((await db.execute(sql`select status from offer_anomalies where id=${first.id}::uuid`)).rows[0]!.status,'resolved');
    await snapshot('一块普通石头');await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    assert.equal((await db.execute(sql`select status from offer_anomalies where id=${first.id}::uuid`)).rows[0]!.status,'open');
    await db.execute(sql`update offer_anomalies set status='ignored',resolved_at=${at} where id=${first.id}::uuid`);
    await snapshot('一块普通石头');await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    assert.equal((await db.execute(sql`select status from offer_anomalies where id=${first.id}::uuid`)).rows[0]!.status,'ignored');
    // Legacy duplicate already exists at the current raw: reuse it without unique conflicts,
    // carrying forward the older manual ignore, without mass-updating old rows.
    const raw=await snapshot('一块普通石头');
    await db.execute(sql`insert into offer_anomalies(raw_offer_snapshot_id,source_id,kind,severity,status)
      values(${raw}::uuid,${source}::uuid,'unclassified_product','warning','open')`);
    await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    const duplicate=(await db.execute(sql`select status from offer_anomalies where raw_offer_snapshot_id=${raw}::uuid and kind='unclassified_product'`)).rows[0]!;
    assert.equal(duplicate.status,'ignored');
    const before=(await db.execute(sql`select count(*)::int n from offer_anomalies`)).rows[0]!.n;
    await snapshot('一块普通石头');await publishLatestSnapshots(db,{now:at,allowEmpty:true});
    assert.equal((await db.execute(sql`select count(*)::int n from offer_anomalies`)).rows[0]!.n,before);
  } finally {await handle.close();await admin.query(`drop database "${name}"`);await admin.end();}
});
