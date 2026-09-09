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
 assert.match(row.officialFloor!.note,/日本 App Store/);
 const noUS=buildHomeBaseline([low],[])[0]!;
 assert.equal(noUS.official,null);
 assert.equal(noUS.officialFloor?.cny,100);
 assert.equal(buildHomeBaseline([],[])[0]!.officialFloor,null);
});
