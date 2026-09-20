import assert from "node:assert/strict";
import test from "node:test";
import {
  CLARITY_PROJECT_ID,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  clarityBootstrap,
  googleAnalyticsBootstrap,
} from "../app/analytics-tags";

test("analytics tags target the configured PriceAI projects", () => {
  assert.equal(GOOGLE_ANALYTICS_MEASUREMENT_ID, "G-HL70Z3V7Z7");
  assert.match(googleAnalyticsBootstrap, /gtag\('config', 'G-HL70Z3V7Z7'\)/);

  assert.equal(CLARITY_PROJECT_ID, "yl5tdfvwjh");
  assert.match(clarityBootstrap, /https:\/\/www\.clarity\.ms\/tag\//);
  assert.match(clarityBootstrap, /"yl5tdfvwjh"/);
});
