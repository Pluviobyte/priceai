import test from 'node:test';
import assert from 'node:assert/strict';
import type { CollectorRegistry } from '@price-radar/collector-sdk';
import type { ProbeResult } from '@price-radar/schema';
import { resolveSubmissionProbes } from './submissions.js';
import { platformRequestIntervalMs } from './platform-policy.js';
const verified: ProbeResult={supported:true,collectorKind:'shop_api',confidence:0.98,evidence:['public_shop_api_response'],identity:{platformKind:'ldxp_shop_api',platformMerchantId:'A',shopToken:'A',canonicalEntryUrl:'https://wzyp.cn/shop/A'}};
const signal=new AbortController().signal;
function registry() {
 let probes=0;
 return {get calls(){return probes;},api:{get:()=>({kind:'shop_api'}),probe:async()=>{probes++;return [verified];}} as unknown as CollectorRegistry};
}
test('automatic admission reuses the current verified identity without a second network probe',async()=>{
 const r=registry();assert.deepEqual(await resolveSubmissionProbes(r.api,new URL('https://wzyp.cn/shop/A'),signal,verified),[verified]);assert.equal(r.calls,0);
});
test('manual intake and mismatched or unsupported cached identities still probe',async()=>{
 const r=registry();
 await resolveSubmissionProbes(r.api,new URL('https://wzyp.cn/shop/A'),signal);
 await resolveSubmissionProbes(r.api,new URL('https://wzyp.cn/shop/B'),signal,verified);
 await resolveSubmissionProbes(r.api,new URL('https://wzyp.cn/shop/A'),signal,{...verified,supported:false});
 assert.equal(r.calls,3);
 await assert.rejects(resolveSubmissionProbes(r.api,new URL('https://wzyp.cn/shop/A'),AbortSignal.abort(),verified));
});
test('3-second pacing applies only to LDXP aliases, not other platforms',()=>{
 const old=process.env.LDXP_PLATFORM_INTERVAL_MS;
 try{
  process.env.LDXP_PLATFORM_INTERVAL_MS='3000';
  assert.equal(platformRequestIntervalMs('wzyp.cn',5500),3000);
  assert.equal(platformRequestIntervalMs('pay.ldxp.cn',5500),3000);
  assert.equal(platformRequestIntervalMs('catfk.com',5500),5500);
  process.env.LDXP_PLATFORM_INTERVAL_MS='invalid';
  assert.equal(platformRequestIntervalMs('wzyp.cn',5500),5500);
 }finally{if(old===undefined)delete process.env.LDXP_PLATFORM_INTERVAL_MS;else process.env.LDXP_PLATFORM_INTERVAL_MS=old;}
});
