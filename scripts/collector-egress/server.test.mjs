import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createEgressServer, validateRequest, relayIntervalMs } from './server.mjs';
test('relay only permits the public read-only Shop API',()=>{
 for(const url of ['http://wzyp.cn/shopApi/Shop/info','https://127.0.0.1/shopApi/Shop/info','https://wzyp.cn/admin','https://wzyp.cn:444/shopApi/Shop/info','https://user@wzyp.cn/shopApi/Shop/info']) assert.throws(()=>validateRequest({url,body:'{"token":"A"}'}));
 assert.throws(()=>validateRequest({url:'https://wzyp.cn/shopApi/Shop/info',body:'{"token":"A","password":"x"}'}));
});
test('authentication, response forwarding and serialization',async()=>{
 const token='t'.repeat(40);let calls=0;
 const server=createEgressServer({token,intervalMs:30,fetchImpl:async()=>{calls++;return new Response('{"code":1}',{headers:{'content-type':'application/json'}});}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
 try{
 assert.equal((await fetch(base+'/fetch',{method:'POST'})).status,401);
 const init={method:'POST',headers:{authorization:`Bearer ${token}`},body:JSON.stringify({url:'https://wzyp.cn/shopApi/Shop/info',body:'{"token":"ABC"}'})};
 const r=await fetch(base+'/fetch',init);assert.equal(r.status,200);assert.equal((await r.json()).body,'{"code":1}');
 const started=Date.now();assert.equal((await fetch(base+'/fetch',init)).status,200);assert.ok(Date.now()-started>=15);assert.equal(calls,2);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('relay pacing is configurable without exposing credentials',()=>{
 assert.equal(relayIntervalMs({COLLECTOR_CN_INTERVAL_MS:'3000'}),3000);
 assert.equal(relayIntervalMs({}),5000);
 for(const value of ['0','-1','abc','2.5']) assert.throws(()=>relayIntervalMs({COLLECTOR_CN_INTERVAL_MS:value}));
});

test('gzip compresses the relay envelope and the client reads identical JSON',async()=>{
 const token='g'.repeat(40),body=JSON.stringify({list:Array.from({length:100},()=>({title:'AI subscription',price:10}))});
 const server=createEgressServer({token,intervalMs:1,fetchImpl:async()=>new Response(body,{headers:{'content-type':'application/json'}})});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{
  const response=await fetch(`http://127.0.0.1:${server.address().port}/fetch`,{method:'POST',headers:{authorization:`Bearer ${token}`,'accept-encoding':'gzip'},body:JSON.stringify({url:'https://wzyp.cn/shopApi/Shop/info',body:'{"token":"ABC"}'})});
  assert.equal(response.headers.get('content-encoding'),'gzip');
  assert.ok(Number(response.headers.get('content-length'))<body.length/2);
  assert.equal((await response.json()).body,body);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
