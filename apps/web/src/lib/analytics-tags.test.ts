import assert from "node:assert/strict";
import test from "node:test";
import {
  CLARITY_PROJECT_ID,
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
  clarityBootstrap,
  googleAnalyticsBootstrap,
  outboundClickTracking,
} from "../app/analytics-tags";

test("analytics tags target the configured PriceAI projects", () => {
  assert.equal(GOOGLE_ANALYTICS_MEASUREMENT_ID, "G-HL70Z3V7Z7");
  assert.match(googleAnalyticsBootstrap, /gtag\('config', 'G-HL70Z3V7Z7'\)/);

  assert.equal(CLARITY_PROJECT_ID, "yl5tdfvwjh");
  assert.match(clarityBootstrap, /https:\/\/www\.clarity\.ms\/tag\//);
  assert.match(clarityBootstrap, /"yl5tdfvwjh"/);
});

test("buy-link clicks are reported once per click with the offer id", () => {
  const listeners: Array<(event: unknown) => void> = [];
  const events: unknown[][] = [];
  const link = { getAttribute: () => "/out/d0a6c7f4-a66f-4f88-9273-987dd040c6ec?x=1" };
  const context = {
    document: { addEventListener: (_: string, listener: (event: unknown) => void) => listeners.push(listener) },
    location: { pathname: "/products/chatgpt-plus" },
    window: { gtag: (...args: unknown[]) => events.push(args) } as Record<string, unknown>,
  };
  new Function("document", "location", "window", outboundClickTracking)(context.document, context.location, context.window);
  listeners[0]!({ target: { closest: (selector: string) => selector.includes("/out/") ? link : null } });
  listeners[0]!({ target: { closest: () => null } });
  assert.deepEqual(events, [["event", "outbound_click", {
    offer_id: "d0a6c7f4-a66f-4f88-9273-987dd040c6ec", page_path: "/products/chatgpt-plus", transport_type: "beacon",
  }]]);
});
