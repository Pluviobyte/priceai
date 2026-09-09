import test from 'node:test';
import { platformKeyForUrl } from '@price-radar/pipeline';
import assert from 'node:assert/strict';
import { PlatformTaskPool, IncrementalPublisher } from './channel-execution.js';
const gate = () => { let resolve!: () => void; const promise = new Promise<void>(r => {resolve=r;}); return {promise,resolve}; };
const turn = () => new Promise<void>(r => setImmediate(r));

test('different platforms overlap; refresh and admission on the same platform remain FIFO', async () => {
  const pool = new PlatformTaskPool(2, new AbortController().signal);
  const hold=gate(), started=gate(); const events:string[]=[];
  const a=pool.run(platformKeyForUrl('https://wzyp.cn/shop/a'),async()=>{events.push('refresh');started.resolve();await hold.promise;events.push('refreshed');});
  const b=pool.run(platformKeyForUrl('https://pay.ldxp.cn/shop/b'),async()=>{events.push('admission');});
  const c=pool.run('catfk',async()=>{await started.promise;events.push('other-platform');hold.resolve();});
  await Promise.all([a,b,c]);
  assert.deepEqual(events,['refresh','other-platform','refreshed','admission']);
});

test('platform concurrency is bounded and a failed platform frees its slot', async () => {
  const pool=new PlatformTaskPool(2,new AbortController().signal);let active=0,max=0;
  const results=await Promise.allSettled(Array.from({length:8},(_,i)=>pool.run(String(i),async()=>{
    max=Math.max(max,++active);await turn();active--;if(i===0)throw new Error('unavailable');
  })));
  assert.equal(max,2);assert.equal(results.filter(r=>r.status==='fulfilled').length,7);
});

test('abort skips queued work and waits for in-flight work to settle', async () => {
  const abort=new AbortController(),pool=new PlatformTaskPool(1,abort.signal),hold=gate(),started=gate();let ran=false;
  const a=pool.run('wzyp',async()=>{started.resolve();await hold.promise;});
  const b=pool.run('catfk',async()=>{ran=true;});const outcomes=Promise.allSettled([a,b]);
  await started.promise;abort.abort();hold.resolve();
  assert.equal((await outcomes)[1]!.status,'rejected');assert.equal(ran,false);
});

test('publish after three changes; new changes during publication reach a second generation without overlap', async () => {
  const hold=gate(),started=gate();let calls=0,active=0,max=0;
  const pub=new IncrementalPublisher(async()=>{calls++;max=Math.max(max,++active);if(calls===1){started.resolve();await hold.promise;}active--;},error=>assert.fail(String(error)));
  pub.changed();pub.changed();await turn();assert.equal(calls,0);
  pub.changed();await started.promise;pub.changed();pub.changed();hold.resolve();await pub.flush();
  assert.equal(calls,2);assert.equal(max,1);
});

test('a single completed shop publishes on the timer while another platform is still running', async () => {
  const published=gate();let calls=0;
  const pub=new IncrementalPublisher(async()=>{calls++;published.resolve();},error=>assert.fail(String(error)),3,10);
  pub.changed();await published.promise;await pub.flush();assert.equal(calls,1);
});

test('failed publication retains changes and flush retries; clean cycles do not publish', async () => {
  let calls=0,errors=0;const failed=gate();
  const pub=new IncrementalPublisher(async()=>{if(++calls===1)throw new Error('database unavailable');},()=>{errors++;failed.resolve();},1,10000);
  pub.changed();await failed.promise;await pub.flush();assert.equal(calls,2);assert.equal(errors,1);
  const empty=new IncrementalPublisher(async()=>assert.fail('empty cycle'),error=>assert.fail(String(error)));await empty.flush();
});

test('continuous dispatch replenishes a fast platform before the slow platform finishes',async()=>{
 const {dispatchContinuously}=await import('./channel-execution.js');
 const abort=new AbortController(),slow=gate(),fastTwice=gate();let fast=0,slowStarted=false;const errors:unknown[]=[];
 const run=dispatchContinuously({concurrency:2,signal:abort.signal,
  pull:async busy=>{
   if(!slowStarted&&!busy.includes('slow')){slowStarted=true;return {platform:'slow'};}
   if(fast<2&&!busy.includes('fast'))return {platform:'fast'};
  },
  work:async job=>{if(job.platform==='slow')await slow.promise;else if(++fast===2)fastTwice.resolve();},
  onError:error=>errors.push(error)});
 await fastTwice.promise;assert.equal(fast,2);abort.abort();slow.resolve();await run;assert.deepEqual(errors,[]);
});
