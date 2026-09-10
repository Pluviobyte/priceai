import test from 'node:test';import assert from 'node:assert/strict';
import {publicItemUnavailable} from './public-item-status.js';
const url=new URL('https://example.com/item/80'),signal=new AbortController().signal;
test('public item business errors are distinguished from verification pages and live items',async()=>{
 for(const [body,expected] of [['{"code":0,"msg":"该商品暂未上架"}',true],['<html>访问验证</html>',false],['{"code":1,"msg":"success"}',false],['{"code":0,"msg":"请登录"}',false]] as const){
  const result=await publicItemUnavailable(url,signal,async()=>new Response(body));assert.equal(Boolean(result),expected);
 }
});
test('unknown public item responses are bounded and never follow redirects',async()=>{
 const result=await publicItemUnavailable(url,signal,async(_u,init)=>{assert.equal(init?.redirect,'error');return new Response('x'.repeat(70000));});assert.equal(result,null);
});
