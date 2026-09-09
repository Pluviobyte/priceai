import assert from 'node:assert/strict';
import test from 'node:test';
import { createEgressFetch } from './egress.js';
import { PlatformDeferredError } from './request-policy.js';
test('explicit hosts route and remote failure never falls back to the production IP',async()=>{
  const original=globalThis.fetch;const calls:string[]=[];
  try {
    globalThis.fetch=async(input)=>{calls.push(String(input));return new Response(JSON.stringify({status:200,headers:{'content-type':'application/json'},body:'{"code":1}'}));};
    const routed=createEgressFetch({COLLECTOR_CN_HOSTS:'wzyp.cn',COLLECTOR_CN_ENDPOINT:'http://127.0.0.1:17890/fetch',COLLECTOR_CN_TOKEN:'test-token'});
    assert.equal((await routed('https://wzyp.cn/shopApi/Shop/info',{method:'POST',body:'{}'})).status,200);
    assert.deepEqual(calls,['http://127.0.0.1:17890/fetch']);
    await routed('https://catfk.com/shopApi/Shop/info',{method:'POST',body:'{}'});
    assert.equal(calls[1],'https://catfk.com/shopApi/Shop/info');
    globalThis.fetch=async(input)=>{calls.push(String(input));throw new Error('offline');};
    await assert.rejects(routed('https://wzyp.cn/shopApi/Shop/info',{method:'POST',body:'{}'}),PlatformDeferredError);
    assert.equal(calls.length,3);assert.equal(calls[2],'http://127.0.0.1:17890/fetch');
  }finally{globalThis.fetch=original;}
});
test('partial remote configuration fails at startup',()=>{
  assert.throws(()=>createEgressFetch({COLLECTOR_CN_HOSTS:'wzyp.cn'}),/configuration_incomplete/);
});
