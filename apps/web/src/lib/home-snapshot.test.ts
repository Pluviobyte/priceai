import test from "node:test";
import assert from "node:assert/strict";
import { createAsyncCache, createStaleWhileRevalidate } from "./async-cache";
import {buildHomeBaseline, readHomeSnapshot, type HomeOffer, type HomeSnapshot} from "./home-snapshot";

const emptySnapshot = (): HomeSnapshot => ({ baseline: [], changes: [], coverage: {
 verifiedOfferCount:0,activeSourceCount:0,officialVendorCount:0,publishedAt:null,
}, placeholder:false });

test("home minimum, merchant and distribution belong to the same delivery mode",()=>{
 const base:HomeOffer={id:"a",slug:"chatgpt-plus",price:"50",currency:"CNY",mode:"recharge",merchant_id:"m1",merchant_name:"甲",warranty_type:"none",verified_at:new Date()};
 const rows=buildHomeBaseline([], [base,{...base,id:"b",price:"90",merchant_id:"m2"},{...base,id:"c",price:"999",mode:"finished_account"},{...base,id:"d",price:"1",currency:"USD"}]);
 const row=rows[0]!;
 assert.equal(row.lowest?.merchantName,"甲");assert.equal(row.lowest?.cny,50);
 assert.deepEqual(row.band,{minCny:50,maxCny:90});assert.equal(row.offerCount,2);assert.equal(row.inStockMerchantCount,2);
 assert.equal(rows.find(r=>r.slug==="claude-pro")!.lowest,null);
 assert.deepEqual(rows.map(r=>r.slug),["chatgpt-plus","chatgpt-pro-5x","chatgpt-pro-20x","claude-pro","claude-max-5x","claude-max-20x","gemini-pro","supergrok","resource-gmail"]);
});

test("home ignores non-finite and nonpositive prices and keeps verification time of the minimum",()=>{
 const old=new Date(Date.now()-3600000), fresh=new Date();
 const base:HomeOffer={id:"a",slug:"claude-pro",price:"80",currency:"CNY",mode:"recharge",merchant_id:"m1",merchant_name:"甲",warranty_type:"none",verified_at:old};
 const row=buildHomeBaseline([],[base,{...base,id:"b",price:"100",verified_at:fresh},{...base,id:"c",price:"NaN"},{...base,id:"d",price:"0"}]).find(r=>r.slug==="claude-pro")!;
 assert.equal(row.lowest?.cny,80);assert.equal(row.verifiedAt,old.toISOString());assert.equal(row.offerCount,2);
});

test("official regular and floor use current, verified monthly prices with separate evidence", async () => {
 const now = new Date();
 const base: import("./public-pricing").OfficialSubscriptionPrice = {
  id:"us",vendor:"OpenAI",planCode:"chatgpt-plus-monthly",planName:"ChatGPT Plus",billingPeriod:"month",
  channel:"web",countryCode:"US",currency:"USD",priceKind:"exact",amount:"20",lowerAmount:null,upperAmount:null,
  cnyEstimate:"140",rawPlanName:"ChatGPT Plus",appId:null,evidenceUrl:"https://example.com/us",verifiedAt:now,
  exchangeRateDate:now.toISOString().slice(0,10),exchangeRateUrl:null,historyCount:1,
  evidence:{billingPeriod:"month",billingEvidenceUrl:"https://example.com/billing"},
 };
 const low={...base,id:"jp",countryCode:"JP",channel:"app_store",currency:"JPY",amount:"2000",cnyEstimate:"100",evidenceUrl:"https://example.com/jp",rawPlanName:"ChatGPT Plus - Monthly"};
 const row=buildHomeBaseline([base,low,
  {...low,id:"stale",cnyEstimate:"10",verifiedAt:new Date(Date.now()-72*3600000)},
  {...low,id:"year",cnyEstimate:"20",billingPeriod:"year"},
  {...low,id:"range",cnyEstimate:"30",priceKind:"range"},
  {...low,id:"unverified",cnyEstimate:"40",collectionStatus:"billing_unverified"},
  {...low,id:"old-fx",cnyEstimate:"50",exchangeRateDate:"2000-01-01"},
 ],[])[0]!;
 assert.equal(row.official?.cny,140);
 assert.equal(row.officialFloor?.cny,100);
 assert.equal(row.officialFloor?.evidenceUrl,"https://example.com/jp");
 assert.equal(row.officialFloor?.detailUrl,"/official-prices/openai__chatgpt-plus-monthly#quote-jp");
 assert.equal(row.official?.detailUrl,"/official-prices/openai__chatgpt-plus-monthly#quote-us");
 assert.match(row.officialFloor!.note,/日本 App Store/);
 const noUS=buildHomeBaseline([low],[])[0]!;
 assert.equal(noUS.official,null);
 assert.equal(noUS.officialFloor?.cny,100);
 assert.equal(buildHomeBaseline([],[])[0]!.officialFloor,null);
});

test("homepage returns an uncached degraded snapshot when pointer verification fails", async () => {
 const cache=createAsyncCache<string,HomeSnapshot>({ttlMs:1000,maxEntries:2,shouldCache:value=>!value.warnings?.length});
 let pointers=0,loads=0;
 const snapshot=await readHomeSnapshot({
  cache,
  getPointer:async()=>{pointers++;if(pointers===2)throw new Error("temporary");return {generation_id:"a"};},
  load:async generationId=>{loads++;assert.equal(generationId,"a");return emptySnapshot();},
 });
 assert.deepEqual(snapshot.warnings,["发布版本复核暂时失败"]);
 assert.equal(cache.stats().size,0);
 assert.equal(loads,1);
});

test("homepage retries a publication switch with the new exact generation", async () => {
 const cache=createAsyncCache<string,HomeSnapshot>({ttlMs:1000,maxEntries:2});
 const pointers=["a","b","b","b"],loads:Array<string|undefined>=[];
 const snapshot=await readHomeSnapshot({
  cache,
  getPointer:async()=>({generation_id:pointers.shift()??"b"}),
  load:async generationId=>{loads.push(generationId);return emptySnapshot();},
 });
 assert.equal(snapshot.placeholder,false);
 assert.deepEqual(loads,["a","b"]);
});

test("homepage answers a new publication with the previous snapshot while it loads", async () => {
 const cache=createAsyncCache<string,HomeSnapshot>({ttlMs:60_000,maxEntries:4});
 const staleFor=createStaleWhileRevalidate(cache,{maxStaleMs:60_000});
 let pointer="a",release!:()=>void;
 const loads:Array<string|undefined>=[];
 const dependencies={cache,staleFor,getPointer:async()=>({generation_id:pointer}),
  load:async(generationId?:string)=>{loads.push(generationId);if(generationId==="b")await new Promise<void>(resolve=>{release=resolve;});
   return {...emptySnapshot(),coverage:{...emptySnapshot().coverage,publishedAt:generationId??null}};}};
 assert.equal((await readHomeSnapshot(dependencies)).coverage.publishedAt,"a");
 pointer="b";
 assert.equal((await readHomeSnapshot(dependencies)).coverage.publishedAt,"a","the previous publication while b loads");
 release();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await readHomeSnapshot(dependencies)).coverage.publishedAt,"b");
 assert.deepEqual(loads,["a","b"]);
});

test("resource rows give a price range, never a crowned minimum or an official comparison",()=>{
 const now=new Date(),earlier=new Date(Date.now()-3600000);
 const base:HomeOffer={id:"a",slug:"resource-gmail",price:"0.5",currency:"CNY",mode:"redeem_code",merchant_id:"m1",merchant_name:"甲",warranty_type:"none",verified_at:earlier};
 const row=buildHomeBaseline([],[base,{...base,id:"b",price:"12",mode:"finished_account",merchant_id:"m2",verified_at:now},{...base,id:"c",price:"0"}]).find(r=>r.slug==="resource-gmail")!;
 assert.equal(row.kind,"resource");
 assert.equal(row.lowest,null);assert.equal(row.official,null);
 assert.deepEqual(row.band,{minCny:0.5,maxCny:12});
 assert.equal(row.offerCount,2);assert.equal(row.inStockMerchantCount,2);
 assert.equal(row.verifiedAt,now.toISOString());
});
