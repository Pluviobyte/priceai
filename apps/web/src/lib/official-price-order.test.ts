import test from "node:test";
import assert from "node:assert/strict";
import { buildHomeBaseline } from "./home-snapshot";
import { applyCurrentCnyRates, selectCollectedSubscriptionMinimum, sortCollectedSubscriptionPrices, type CurrentCnyRate, type OfficialSubscriptionPrice } from "./public-pricing";

// Amounts and stored conversions below are production records from 2026-09-23.
const now = new Date();
const price = (id: string, fields: Partial<OfficialSubscriptionPrice>): OfficialSubscriptionPrice => ({
 id,vendor:"openai",planCode:"chatgpt-pro-20x-monthly",planName:"ChatGPT Pro 20x",billingPeriod:"month",
 channel:"web",countryCode:"US",currency:"USD",priceKind:"exact",amount:"200",lowerAmount:null,upperAmount:null,
 cnyEstimate:"1340",rawPlanName:"Pro",appId:null,evidenceUrl:`https://example.com/${id}`,verifiedAt:now,
 exchangeRateDate:now.toISOString().slice(0,10),exchangeRateUrl:null,historyCount:1,
 evidence:{billingPeriod:"month",billingEvidenceUrl:"https://example.com/billing"},...fields,
});
const today = now.toISOString().slice(0,10);
const rates = (entries: Record<string, string>) => new Map<string, CurrentCnyRate>(
 Object.entries(entries).map(([currency, rate]) => [currency, { rate, effectiveDate: today, sourceUrl: "https://ecb.example" }]));
const ids = (rows: OfficialSubscriptionPrice[]) => rows.map(row => row.id);
const figures = (rows: OfficialSubscriptionPrice[]) => rows.filter(row => row.cnyEstimate !== null).map(row => Number(row.cnyEstimate));
const assertAscending = (rows: OfficialSubscriptionPrice[]) => assert.deepEqual(figures(rows), [...figures(rows)].sort((a, b) => a - b));

test("records swept on different days convert at one current rate, leaving the collected facts alone",()=>{
 const kw=price("kw-app",{channel:"app_store",countryCode:"KW",amount:"30",cnyEstimate:"200.86",exchangeRateDate:"2026-09-16",verifiedAt:new Date("2026-09-22T01:00:00Z")});
 const [kwNow,usNow,cny,range,unrated]=applyCurrentCnyRates([
  kw,
  price("us-web",{amount:"30",cnyEstimate:"201.002355"}),
  price("cn-app",{channel:"app_store",countryCode:"CN",currency:"CNY",amount:"198",cnyEstimate:"198",exchangeRateDate:null}),
  price("br-range",{countryCode:"BR",currency:"BRL",priceKind:"range",amount:null,cnyEstimate:null,exchangeRateDate:null}),
  price("kwd",{countryCode:"KW",currency:"KWD",amount:"9",cnyEstimate:"210",exchangeRateDate:"2026-09-10"}),
 ],rates({USD:"6.7000785",BRL:"1.31"}));
 assert.equal(kwNow!.cnyEstimate,"201.002355");
 assert.equal(usNow!.cnyEstimate,kwNow!.cnyEstimate);
 assert.equal(kwNow!.exchangeRateDate,today);
 assert.equal(kwNow!.exchangeRateUrl,"https://ecb.example");
 assert.equal(kwNow!.amount,"30");
 assert.equal(kwNow!.verifiedAt,kw.verifiedAt);
 assert.equal(kwNow!.evidenceUrl,kw.evidenceUrl);
 assert.equal(cny!.cnyEstimate,"198");
 assert.equal(range!.cnyEstimate,null);
 // Without a current rate the stored conversion stays, still labelled with its own date.
 assert.equal(unrated!.cnyEstimate,"210");assert.equal(unrated!.exchangeRateDate,"2026-09-10");
});

test("the official site leads the app store at the same price, but a cheaper app store stays first",()=>{
 const rows=applyCurrentCnyRates([
  price("jp-app",{channel:"app_store",countryCode:"JP",currency:"JPY",amount:"30000"}),
  price("ca-web",{countryCode:"CA",currency:"CAD",amount:"250"}),
  price("ph-app",{channel:"app_store",countryCode:"PH",currency:"PHP",amount:"9990"}),
  price("jp-web",{countryCode:"JP",currency:"JPY",amount:"30000"}),
  price("ca-app",{channel:"app_store",countryCode:"CA",currency:"CAD",amount:"249"}),
  price("ph-web",{countryCode:"PH",currency:"PHP",amount:"9990"}),
 ],rates({PHP:"0.107263",CAD:"4.770683",JPY:"0.042628"}));
 const sorted=sortCollectedSubscriptionPrices(rows);
 assert.deepEqual(ids(sorted),["ph-web","ph-app","ca-app","ca-web","jp-web","jp-app"]);
 assertAscending(sorted);
 assert.equal(selectCollectedSubscriptionMinimum(rows)?.id,"ph-web");
});

test("a same price never jumps ahead of a cheaper different price, and the minimum is the lowest figure shown",()=>{
 // Stored, these two converted to ¥1852.08 and ¥1867.08, either side of a ¥1860 EUR price.
 const ultra={planCode:"google-ai-ultra-monthly",countryCode:"HU",currency:"HUF",amount:"99990"};
 const rows=applyCurrentCnyRates([
  price("hu-app",{...ultra,channel:"app_store",cnyEstimate:"1852.08"}),
  price("hu-web",{...ultra,cnyEstimate:"1867.08"}),
  price("it-eur",{planCode:"google-ai-ultra-monthly",countryCode:"IT",currency:"EUR",amount:"249.99",cnyEstimate:"1860"}),
 ],rates({HUF:"0.0187",EUR:"7.44"}));
 const sorted=sortCollectedSubscriptionPrices(rows);
 assert.deepEqual(ids(sorted),["it-eur","hu-web","hu-app"]);
 assertAscending(sorted);
 assert.equal(Number(selectCollectedSubscriptionMinimum(rows)?.cnyEstimate),Math.min(...figures(sorted)));
});

test("the same currency and amount in another region is still the same price",()=>{
 const rows=applyCurrentCnyRates([
  price("kw-app",{planCode:"supergrok-monthly",channel:"app_store",countryCode:"KW",amount:"30",cnyEstimate:"200.86"}),
  price("us-web",{planCode:"supergrok-monthly",amount:"30",cnyEstimate:"201.002355"}),
 ],rates({USD:"6.7000785"}));
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
 const pro={planCode:"google-ai-pro-monthly",countryCode:"ID",currency:"IDR",amount:"309000"};
 // The app store was swept after the website, which is what used to decide this tie.
 const row=buildHomeBaseline(applyCurrentCnyRates([
  price("id-app",{...pro,channel:"app_store"}),
  price("id-web",{...pro,verifiedAt:new Date(now.getTime()-3600000)}),
 ],rates({IDR:"0.000376"})),[]).find(r=>r.slug==="gemini-pro")!;
 assert.equal(row.officialFloor?.evidenceUrl,"https://example.com/id-web");
 assert.match(row.officialFloor!.note,/印度尼西亚 官网 IDR 309000/);

 const grok=buildHomeBaseline(applyCurrentCnyRates([
  price("kw-app",{planCode:"supergrok-monthly",channel:"app_store",countryCode:"KW",amount:"30",cnyEstimate:"200.86"}),
  price("us-web",{planCode:"supergrok-monthly",amount:"30",cnyEstimate:"201.002355"}),
 ],rates({USD:"6.7000785"})),[]).find(r=>r.slug==="supergrok")!;
 assert.match(grok.officialFloor!.note,/美国 官网 USD 30/);
 assert.equal(grok.officialFloor?.cny,201.002355);
});
