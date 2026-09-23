import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeBaseline } from "./home-snapshot";
import { selectCollectedSubscriptionMinimum, sortCollectedSubscriptionPrices, type OfficialSubscriptionPrice } from "./public-pricing";

// Amounts and conversions below are production records from 2026-09-23.
const now = new Date();
const price = (id: string, fields: Partial<OfficialSubscriptionPrice>): OfficialSubscriptionPrice => ({
 id,vendor:"openai",planCode:"chatgpt-pro-20x-monthly",planName:"ChatGPT Pro 20x",billingPeriod:"month",
 channel:"web",countryCode:"US",currency:"USD",priceKind:"exact",amount:"200",lowerAmount:null,upperAmount:null,
 cnyEstimate:"1340",rawPlanName:"Pro",appId:null,evidenceUrl:`https://example.com/${id}`,verifiedAt:now,
 exchangeRateDate:now.toISOString().slice(0,10),exchangeRateUrl:null,historyCount:1,
 evidence:{billingPeriod:"month",billingEvidenceUrl:"https://example.com/billing"},...fields,
});
const ids = (rows: OfficialSubscriptionPrice[]) => rows.map(row => row.id);

test("the official site leads the app store at the same price, but a cheaper app store stays first",()=>{
 const rows=[
  price("jp-app",{channel:"app_store",countryCode:"JP",currency:"JPY",amount:"30000",cnyEstimate:"1278.84"}),
  price("ca-web",{countryCode:"CA",currency:"CAD",amount:"250",cnyEstimate:"1192.67"}),
  price("ph-app",{channel:"app_store",countryCode:"PH",currency:"PHP",amount:"9990",cnyEstimate:"1071.56"}),
  price("jp-web",{countryCode:"JP",currency:"JPY",amount:"30000",cnyEstimate:"1278.84"}),
  price("ca-app",{channel:"app_store",countryCode:"CA",currency:"CAD",amount:"249",cnyEstimate:"1187.90"}),
  price("ph-web",{countryCode:"PH",currency:"PHP",amount:"9990",cnyEstimate:"1071.56"}),
 ];
 assert.deepEqual(ids(sortCollectedSubscriptionPrices(rows)),["ph-web","ph-app","ca-app","ca-web","jp-web","jp-app"]);
 assert.equal(selectCollectedSubscriptionMinimum(rows)?.id,"ph-web");
});

test("one amount is one price even when its two conversions used different exchange-rate dates",()=>{
 const ultra={planCode:"google-ai-ultra-monthly",countryCode:"HU",currency:"HUF",amount:"99990"};
 const rows=[
  price("between",{planCode:"google-ai-ultra-monthly",countryCode:"IT",currency:"EUR",amount:"249.99",cnyEstimate:"1860"}),
  price("hu-app",{...ultra,channel:"app_store",cnyEstimate:"1852.08"}),
  price("hu-web",{...ultra,cnyEstimate:"1867.08"}),
 ];
 // The pair ranks at its cheaper conversion, so a price converting between the two follows both.
 assert.deepEqual(ids(sortCollectedSubscriptionPrices(rows)),["hu-web","hu-app","between"]);
});

test("the same currency and amount in another region is still the same price",()=>{
 const rows=[
  price("kw-app",{planCode:"supergrok-monthly",channel:"app_store",countryCode:"KW",amount:"30",cnyEstimate:"200.86"}),
  price("us-web",{planCode:"supergrok-monthly",amount:"30",cnyEstimate:"201.002355"}),
 ];
 assert.equal(selectCollectedSubscriptionMinimum(rows)?.id,"us-web");
});

test("records without a usable conversion still follow every comparable price",()=>{
 const rows=[
  price("br-range",{countryCode:"BR",priceKind:"range",amount:null,cnyEstimate:null}),
  price("ar-no-fx",{countryCode:"AR",cnyEstimate:null}),
  price("us-web",{}),
 ];
 assert.deepEqual(ids(sortCollectedSubscriptionPrices(rows)),["us-web","ar-no-fx","br-range"]);
});

test("the homepage floor names the official site when an app store charges the same",()=>{
 const pro={planCode:"google-ai-pro-monthly",countryCode:"ID",currency:"IDR",amount:"309000",cnyEstimate:"116.18"};
 // The app store was swept after the website, which is what used to decide this tie.
 const row=buildHomeBaseline([
  price("id-app",{...pro,channel:"app_store"}),
  price("id-web",{...pro,verifiedAt:new Date(now.getTime()-3600000)}),
 ],[])[2]!;
 assert.equal(row.officialFloor?.evidenceUrl,"https://example.com/id-web");
 assert.match(row.officialFloor!.note,/印度尼西亚 官网 IDR 309000/);

 const grok=buildHomeBaseline([
  price("kw-app",{planCode:"supergrok-monthly",channel:"app_store",countryCode:"KW",amount:"30",cnyEstimate:"200.86"}),
  price("us-web",{planCode:"supergrok-monthly",amount:"30",cnyEstimate:"201.002355"}),
 ],[])[3]!;
 assert.match(grok.officialFloor!.note,/美国 官网 USD 30/);
 assert.equal(grok.officialFloor?.cny,201.002355);
});
