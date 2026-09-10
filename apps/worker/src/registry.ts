import { publicItemUnavailable } from './public-item-status.js';
import { familyForHost } from '@price-radar/source-signatures';
import type { Database } from "@price-radar/database";
import { PostgresRequestPolicy } from "@price-radar/pipeline";
import { InMemoryCollectorRegistry, mentionsWafChallenge, platformRetryAt } from "@price-radar/collector-sdk";
import { DujiaoCollector } from "@price-radar/dujiao-collector";
import { GenericHtmlCollector } from "@price-radar/generic-html-collector";
import { JsonFeedCollector } from "@price-radar/json-feed-collector";
import { KamiCollector } from "@price-radar/kami-collector";
import { LdxpShopApiCollector } from "@price-radar/shop-api-collector";
import { Sixteen688ShopCollector } from "@price-radar/shop-api-16688-collector";

class WorkerCollectorRegistry extends InMemoryCollectorRegistry {
  override async probe(url: URL, signal: AbortSignal) {
    if(/^\/item\//.test(url.pathname)&&!familyForHost(url.hostname)){
      const unavailable=await publicItemUnavailable(url,signal);
      if(unavailable)return [{collectorKind:'generic_html' as const,supported:false,confidence:1,reason:unavailable,evidence:[]}];
    }
    // Shop paths have a cheap public API. Do not fan out to every HTML adapter
    // after that API has already returned an explicit challenge or cooldown.
    if (/^\/(shop|item)\//.test(url.pathname)) {
      const probe = await this.get("shop_api")!.probe(url, signal);
      if (familyForHost(url.hostname)?.platformKind === 'ldxp_shop_api' || probe.reason?.startsWith('shop_api_rejected:') || probe.supported || mentionsWafChallenge(probe.reason) || platformRetryAt(probe.reason)) return [probe];
    }
    return super.probe(url, signal);
  }
}

/** Every HTTP collector the workers know about, in probe order. Browser fallback is registered by callers that can run Chromium. */
export function createCollectorRegistry(db: Database): InMemoryCollectorRegistry {
  const registry = new WorkerCollectorRegistry();
  registry.register(new LdxpShopApiCollector({ requestPolicy: new PostgresRequestPolicy(db) }));
  registry.register(new Sixteen688ShopCollector());
  registry.register(new KamiCollector());
  registry.register(new DujiaoCollector());
  registry.register(new GenericHtmlCollector());
  registry.register(new GenericHtmlCollector({ kind: "custom_html" }));
  registry.register(new JsonFeedCollector("public_json"));
  registry.register(new JsonFeedCollector("merchant_feed"));
  return registry;
}
