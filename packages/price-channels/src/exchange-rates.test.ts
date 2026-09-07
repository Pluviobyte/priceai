import assert from "node:assert/strict";
import test from "node:test";
import { parseEcbCnyRates } from "./exchange-rates.js";

const now = Date.parse("2026-09-07T15:00:00.000Z");
const csv = (...rows: string[]) => ["CURRENCY,TIME_PERIOD,OBS_VALUE", ...rows].join("\n");

test("reproduces the ECB reference conversions in the pricing table", () => {
  const rates = parseEcbCnyRates(csv(
    "CNY,2026-09-04,7.7994",
    "USD,2026-09-04,1.1622",
    "INR,2026-09-04,109.8165",
    "PHP,2026-09-04,72.812",
  ), now);
  assert.equal(rates.find(row => row.currency === "EUR")?.rate, 7.7994);
  for (const [currency, amount, expected] of [
    ["USD", 20, "134.22"], ["USD", 100, "671.09"],
    ["INR", 399, "28.34"], ["PHP", 9990, "1070.10"],
  ] as const) {
    const rate = rates.find(row => row.currency === currency);
    assert.ok(rate);
    assert.equal((amount * rate.rate).toFixed(2), expected);
    assert.equal(rate.effectiveDate, "2026-09-04");
  }
  assert.ok(!rates.some(row => row.currency === "CNY"));
});

test("uses the latest date shared by CNY and the other currency", () => {
  const rates = parseEcbCnyRates(csv(
    "CNY,2026-09-04,8", "CNY,2026-09-03,7",
    "USD,2026-09-03,1.25", "USD,2026-09-02,1.1",
    "GBP,2026-09-02,0.9",
  ), now);
  assert.deepEqual(rates.find(row => row.currency === "USD"), {
    currency: "USD", rate: 7 / 1.25, effectiveDate: "2026-09-03",
  });
  assert.ok(!rates.some(row => row.currency === "GBP"));
});

test("ignores future observations instead of overriding today's valid rates", () => {
  const rates = parseEcbCnyRates(csv(
    "CNY,2026-09-07,7.8", "USD,2026-09-07,1.2",
    "CNY,2099-01-01,80", "USD,2099-01-01,1",
  ), now);
  assert.deepEqual(rates.find(row => row.currency === "USD"), {
    currency: "USD", rate: 6.5, effectiveDate: "2026-09-07",
  });
});

test("allows weekends and observations up to seven UTC calendar days old", () => {
  const rates = parseEcbCnyRates(csv(
    "CNY,2026-08-31,7.8", "USD,2026-08-31,1.2",
    "CNY,2026-08-30,7.7", "GBP,2026-08-30,0.8",
  ), now);
  assert.equal(rates.find(row => row.currency === "USD")?.effectiveDate, "2026-08-31");
  assert.ok(!rates.some(row => row.currency === "GBP"));
});

test("does not produce a rate when CNY has only stale, invalid, or future observations", () => {
  for (const observation of [
    "CNY,2026-08-30,7.8", "CNY,2026-09-08,7.8",
    "CNY,2026-09-04,0", "CNY,2026-09-04,Infinity",
  ]) {
    assert.deepEqual(parseEcbCnyRates(csv(observation, "USD,2026-09-04,1.2"), now), []);
  }
});

test("rejects zero, negative, missing and non-finite rates", () => {
  for (const value of ["0", "-1", "", "NaN", "Infinity", "1e999"]) {
    const rates = parseEcbCnyRates(csv("CNY,2026-09-04,7.8", `USD,2026-09-04,${value}`), now);
    assert.ok(!rates.some(row => row.currency === "USD"), value);
  }
});

test("rejects impossible dates and dates outside the daily observation format", () => {
  for (const date of ["2026-09-31", "2026-02-30", "2026-9-4", "2026-09-04T00:00:00Z", "not-a-date"]) {
    assert.deepEqual(parseEcbCnyRates(csv(`CNY,${date},7.8`, `USD,${date},1.2`), now), []);
  }
});

test("rejects cross rates that overflow or underflow despite finite input", () => {
  assert.ok(!parseEcbCnyRates(csv("CNY,2026-09-04,7.8", "USD,2026-09-04,1e-320"), now)
    .some(row => row.currency === "USD"));
  assert.ok(!parseEcbCnyRates(csv("CNY,2026-09-04,1e-320", "USD,2026-09-04,1e300"), now)
    .some(row => row.currency === "USD"));
});

test("reads quoted CSV fields, including a comma before observation columns", () => {
  const rates = parseEcbCnyRates([
    '\uFEFF"TITLE","OBS_VALUE","TIME_PERIOD","CURRENCY"',
    '"Chinese yuan, reference rate","7.8","2026-09-04","CNY"',
    '"US dollar, reference rate","1.2","2026-09-04","USD"',
  ].join("\r\n"), now);
  assert.equal(rates.find(row => row.currency === "USD")?.rate, 6.5);
});

test("fails explicitly when required CSV columns are missing", () => {
  assert.throws(() => parseEcbCnyRates("CURRENCY,DATE,RATE\nUSD,2026-09-04,1.2", now), /ecb_csv_shape_changed/);
});
