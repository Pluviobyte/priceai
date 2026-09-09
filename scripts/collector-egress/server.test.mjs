import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { createEgressServer, validateRequest } from './server.mjs';
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
