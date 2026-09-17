import pg from 'pg';
import { readFile, statfs } from 'node:fs/promises';
import { availableParallelism, loadavg } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { planSnapshotRetention, pruneSnapshotBatch, validateRetentionPolicy, type RetentionPolicy } from '../packages/pipeline/src/snapshot-retention.js';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const option = (name: string) => { const index=args.indexOf(name); return index < 0 ? undefined : args[index+1]; };
const policyPath = option('--policy');
if (!policyPath) throw new Error('usage: node --import tsx scripts/snapshot-retention.mts --policy file.json [--apply --generation UUID]');
const policy = JSON.parse(await readFile(policyPath, 'utf8')) as RetentionPolicy;
validateRetentionPolicy(policy);
const generationId = option('--generation');
if (apply && !/^[0-9a-f-]{36}$/i.test(generationId ?? '')) throw new Error('apply_requires_one_generation');
const url = process.env.MAINTENANCE_DATABASE_URL;
if (!url) throw new Error('MAINTENANCE_DATABASE_URL_required');
const client = new pg.Client({ connectionString:url, application_name:'priceai-snapshot-retention', connectionTimeoutMillis:5000 });
client.on('error', () => { process.exitCode=1; });
let stopping = false;
process.on('SIGINT', () => { stopping=true; });
process.on('SIGTERM', () => { stopping=true; });

async function plan() {
  const generations=await client.query('select id,channel,previous_generation_id,status,snapshot_state,snapshot_pinned,generated_at,offer_count from publish_generations');
  const pointers=await client.query('select channel,current_generation_id,previous_generation_id from publication_channels');
  return planSnapshotRetention(generations.rows,pointers.rows,policy);
}
async function cpuSample() {
  const values=(await readFile('/proc/stat','utf8')).split('\n')[0]!.trim().split(/\s+/).slice(1,9).map(Number);
  return { total:values.reduce((a,b)=>a+b,0), idle:values[3]!, wait:values[4]! };
}
async function guard() {
  // Apply is intentionally host-local Linux only; a remote laptop's metrics cannot protect DMIT.
  if (process.platform !== 'linux' || !['127.0.0.1','localhost','[::1]'].includes(new URL(url!).hostname)) throw new Error('apply_requires_host_local_database');
  const memory=await readFile('/proc/meminfo','utf8');
  const available=Number(memory.match(/^MemAvailable:\s+(\d+)/m)?.[1] ?? 0)*1024;
  const disk=await statfs('/var/lib/docker');
  const before=await cpuSample(); await delay(250); const after=await cpuSample();
  const total=after.total-before.total;
  if (available<1024**3 || disk.bavail*disk.bsize<20*1024**3 || loadavg()[0]>availableParallelism()*0.75 ||
      total<=0 || (after.wait-before.wait)/total>0.05 || 1-(after.idle-before.idle)/total>0.8) throw new Error('host_capacity_guard_paused');
  const health=await client.query(`select
    (select count(*) from pg_stat_activity where datname=current_database() and pid<>pg_backend_pid()
      and (wait_event_type='Lock' or xact_start<now()-interval '60 seconds')) as busy,
    (select count(*) from pg_stat_progress_vacuum where relid='published_offer_snapshots'::regclass) as vacuuming`);
  if (Number(health.rows[0].busy)>0 || Number(health.rows[0].vacuuming)>0) throw new Error('database_busy_paused');
  const config=await client.query(`select c.reltuples,c.reloptions,current_setting('autovacuum') as enabled,
    current_setting('autovacuum_vacuum_threshold')::float as threshold,
    current_setting('autovacuum_vacuum_scale_factor')::float as factor
    from pg_class c where c.oid='published_offer_snapshots'::regclass`);
  const row=config.rows[0]; const settings=Object.fromEntries((row.reloptions??[]).map((v:string)=>v.split('=')));
  const threshold=Number(settings.autovacuum_vacuum_threshold??row.threshold)+Number(settings.autovacuum_vacuum_scale_factor??row.factor)*Math.max(0,Number(row.reltuples));
  if(row.enabled!=='on' || settings.autovacuum_enabled==='false' || threshold>100_000 || settings.vacuum_truncate!=='false') throw new Error('vacuum_policy_review_required');
}

try {
  await client.connect();
  await client.query("set statement_timeout='3s'"); await client.query("set lock_timeout='200ms'");
  if (!apply) {
    await client.query('begin isolation level repeatable read read only');
    const report=await plan();
    const size=await client.query(`select pg_table_size('published_offer_snapshots')::text as heap_bytes,
      pg_indexes_size('published_offer_snapshots')::text as index_bytes,n_live_tup,n_dead_tup,last_autovacuum,last_vacuum
      from pg_stat_user_tables where relid='published_offer_snapshots'::regclass`);
    await client.query('commit');
    console.log(JSON.stringify({mode:'preview',policy,...report,storage:size.rows[0]},null,2));
  } else {
    // One explicit generation, <=1000 rows per invocation. No daemon, scheduler or automatic retry.
    for(let batch=0;batch<5&&!stopping;batch++) {
      await guard();
      const result=await pruneSnapshotBatch(client,policy,generationId!);
      console.log(JSON.stringify({mode:'apply',generationId,batch,...result}));
      if(result.complete) break;
      await delay(1000);
    }
  }
} catch(error) {
  await client.query('rollback').catch(()=>undefined);
  // Do not print connection strings or pg diagnostics containing application data.
  console.error(JSON.stringify({event:'retention_stopped',code:error instanceof Error ? error.message.split('\n')[0] : 'unknown'}));
  process.exitCode=1;
} finally { await client.end(); }
