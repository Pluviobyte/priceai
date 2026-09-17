import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from '@price-radar/database';

const adminUrl=process.env.POLICY_TEST_DATABASE_URL;
test('feed distinguishes missing, empty, expired and incomplete generations',{skip:!adminUrl},async()=>{
  const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
  const name=`price_feed_test_${randomUUID().replaceAll('-','')}`;
  await admin.query(`create database "${name}"`);
  const url=new URL(adminUrl!);url.pathname=`/${name}`;
  const prior=process.env.DATABASE_URL;process.env.DATABASE_URL=url.toString();
  const handle=createDatabase(url.toString());
  const {databasePool}=await import('./database');
  const {buildGenerationFeed}=await import('./public-feed');
  try{
    await migrate(handle.db,{migrationsFolder:fileURLToPath(new URL('../../../../packages/database/drizzle/',import.meta.url))});
    assert.equal(await buildGenerationFeed(randomUUID()),null);
    const id=randomUUID();
    await databasePool.query("insert into publish_generations(id,status,offer_count) values($1,'published',0)",[id]);
    const empty=await buildGenerationFeed(id);assert.ok(empty && 'body' in empty);assert.equal(empty.offerCount,0);
    for(const state of ['pruning','pruned']){
      await databasePool.query('update publish_generations set snapshot_state=$2 where id=$1',[id,state]);
      assert.deepEqual(await buildGenerationFeed(id),{expired:true});
    }
    await databasePool.query("update publish_generations set snapshot_state='retained',offer_count=1 where id=$1",[id]);
    assert.deepEqual(await buildGenerationFeed(id),{incomplete:true});
  }finally{
    await databasePool.end();await handle.close();await admin.query(`drop database "${name}"`);await admin.end();
    if(prior===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=prior;
  }
});
