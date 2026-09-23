import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '@price-radar/database';

const adminUrl=process.env.POLICY_TEST_DATABASE_URL;
test('transit pagination reaches every provider; health separates task success, full coverage and current anomalies', {skip:!adminUrl}, async()=>{
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
 const name=`health_test_${randomUUID().replaceAll('-','')}`;await admin.query(`create database "${name}"`);
 const url=new URL(adminUrl!);url.pathname=`/${name}`;process.env.DATABASE_URL=url.toString();
 const handle=createDatabase(url.toString());const {databasePool: pool}=await import('./database');
 const {getTransitPrices,getTransitOverview}=await import('./public-pricing');
 const {getPublicHealth}=await import('./public-platform');
 const {getAdminAnomalies}=await import('./admin-data');
 try{
  await migrate(handle.db,{migrationsFolder:fileURLToPath(new URL('../../../../packages/database/drizzle/',import.meta.url))});
  for(const [slug,label,size] of [['openrouter','OpenRouter',310],['vercel','Vercel',3]] as const){
   const p=(await pool.query("insert into transit_providers(slug,display_name,website_url,discovery_source,evidence_url,active) values($1,$2,'https://example.com','test','https://example.com',true) returning id",[slug,label])).rows[0].id;
   await pool.query("insert into transit_model_prices(provider_id,model_code,display_name,input_price,output_price,evidence_kind,evidence_url,verified_at) select $1,'m'||n,'Model '||n,0,1,'provider_self_reported','https://example.com',now() from generate_series(1,$2::int) n",[p,size]);
  }
  assert.equal((await getTransitPrices({provider:'vercel'})).prices.length,3);
  assert.equal((await getTransitPrices({provider:'vercel'})).prices[0]!.inputPrice,'0.00000000');
  const ids=new Set<string>();for(let page=1;page<=7;page++){const result=await getTransitPrices({page});assert.equal(result.pagination.total,313);for(const p of result.prices)ids.add(`${p.providerSlug}:${p.modelCode}`);}
  assert.equal(ids.size,313);
  assert.equal((await getTransitOverview()).prices.length,313);
  assert.equal((await getTransitPrices({provider:'missing'})).pagination.total,0);
  const gen=(await pool.query("insert into publish_generations(status,offer_count) values('published',0) returning id")).rows[0].id;
  await pool.query("insert into publication_channels(channel,current_generation_id) values('card_prices',$1)",[gen]);
  const source=(await pool.query("insert into sources(platform_kind,platform_merchant_id,canonical_entry_url,collector_kind,enabled,last_success_at) values('test','one','https://example.com','json_feed',true,now()) returning id")).rows[0].id;
  const other=(await pool.query("insert into sources(platform_kind,platform_merchant_id,canonical_entry_url,collector_kind,enabled) values('test','two','https://other.example.com','json_feed',true) returning id")).rows[0].id;
  const runs:string[]=[];
  for(const [status,complete] of [['success',true],['success',false],['failed',false],['running',false],['queued',false],['cancelled',false]] as const){
   runs.push((await pool.query("insert into crawl_runs(source_id,collector_kind,collector_version,status,complete_snapshot) values($1,'json_feed','test',$2,$3) returning id",[source,status,complete])).rows[0].id);
  }
  await pool.query('update sources set latest_complete_run_id=$2 where id=$1',[source,runs[0]]);
  // Full and partial snapshots for different goods types; the partial becomes current.
  const raws:string[]=[];
  for(const run of runs.slice(0,2))raws.push((await pool.query("insert into raw_offer_snapshots(source_id,crawl_run_id,source_item_id,raw_title,raw_price_text,raw_price_numeric,currency,stock_state_hint,product_url,raw_payload_hash,goods_type,captured_at) values($1,$2,'one','Thing','1',1,'CNY','in_stock','https://example.com','hash','card',now()) returning id",[source,run])).rows[0].id);
  await pool.query("insert into source_catalog_type_snapshots(source_id,goods_type,run_id,checked_at,item_count) values($1,'card',$2,now(),1)",[source,runs[1]]);
  for(const raw of raws)await pool.query("insert into offer_anomalies(raw_offer_snapshot_id,source_id,kind,severity,status) values($1,$2,'stock_conflict','critical','open')",[raw,source]);
  let health=await getPublicHealth();
  assert.equal(health.successfulRuns24h,2);assert.equal(health.completedRuns24h,3);
  assert.equal(health.runSuccessRate,2/3);assert.equal(health.excludedRuns24h,3);
  assert.equal(health.fullSuccessfulRuns24h,1);assert.equal(health.partialSuccessfulRuns24h,1);
  assert.equal(health.fullCoverageRate,0.5);assert.equal(health.openAnomalyCount,1);
  assert.equal((await getAdminAnomalies()).length,1);
  await pool.query('update sources set enabled=false where id=$1',[source]);
  health=await getPublicHealth();assert.equal(health.openAnomalyCount,0);
  assert.equal((await getAdminAnomalies()).length,0);
  assert.equal(health.enabledSourceCount,1);assert.ok(other);
 } finally{await pool.end();await handle.close();await admin.query(`drop database "${name}"`);await admin.end();}
});
