import { InMemoryCollectorRegistry } from "@price-radar/collector-sdk";
import { DujiaoCollector } from "@price-radar/dujiao-collector";
import { GenericHtmlCollector } from "@price-radar/generic-html-collector";
import { JsonFeedCollector } from "@price-radar/json-feed-collector";
import { KamiCollector } from "@price-radar/kami-collector";
import { LdxpShopApiCollector } from "@price-radar/shop-api-collector";
import { Sixteen688ShopCollector } from "@price-radar/shop-api-16688-collector";

/** Every HTTP collector the workers know about, in probe order. Browser fallback is registered by callers that can run Chromium. */
export function createCollectorRegistry(): InMemoryCollectorRegistry {
  const registry = new InMemoryCollectorRegistry();
  registry.register(new LdxpShopApiCollector());
  registry.register(new Sixteen688ShopCollector());
  registry.register(new KamiCollector());
  registry.register(new DujiaoCollector());
  registry.register(new GenericHtmlCollector());
  registry.register(new GenericHtmlCollector({ kind: "custom_html" }));
  registry.register(new JsonFeedCollector("public_json"));
  registry.register(new JsonFeedCollector("merchant_feed"));
  return registry;
}
