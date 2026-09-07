import test from "node:test";
import assert from "node:assert/strict";
import {buildHomeBaseline, type HomeOffer} from "./home-snapshot";

test("home minimum, merchant and distribution belong to the same delivery mode",()=>{
 const base:HomeOffer={id:"a",slug:"chatgpt-plus",price:"50",currency:"CNY",mode:"recharge",merchant_id:"m1",merchant_name:"甲",warranty_type:"none",verified_at:new Date()};
 const rows=buildHomeBaseline([], [base,{...base,id:"b",price:"90",merchant_id:"m2"},{...base,id:"c",price:"999",mode:"finished_account"},{...base,id:"d",price:"1",currency:"USD"}]);
 const row=rows[0]!;
 assert.equal(row.lowest?.merchantName,"甲");assert.equal(row.lowest?.cny,50);
 assert.deepEqual(row.band,{minCny:50,maxCny:90});assert.equal(row.offerCount,2);assert.equal(row.inStockMerchantCount,2);
 assert.equal(rows[1]!.lowest,null);
 assert.equal(rows[2]!.slug,"gemini-pro");
});

test("home ignores non-finite and nonpositive prices and keeps verification time of the minimum",()=>{
 const old=new Date(Date.now()-3600000), fresh=new Date();
 const base:HomeOffer={id:"a",slug:"claude-pro",price:"80",currency:"CNY",mode:"recharge",merchant_id:"m1",merchant_name:"甲",warranty_type:"none",verified_at:old};
 const row=buildHomeBaseline([],[base,{...base,id:"b",price:"100",verified_at:fresh},{...base,id:"c",price:"NaN"},{...base,id:"d",price:"0"}])[1]!;
 assert.equal(row.lowest?.cny,80);assert.equal(row.verifiedAt,old.toISOString());assert.equal(row.offerCount,2);
});
