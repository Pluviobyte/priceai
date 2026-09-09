import test from 'node:test';
import assert from 'node:assert/strict';
import type { Database } from '@price-radar/database';
import { createCollectorRegistry } from './registry.js';

test('Shop API WAF and budget results stop probe fan-out before HTML/browser adapters', async () => {
  const registry = createCollectorRegistry({} as Database);
  let fallback = 0;
  for (const kind of ['shop_api_16688','kami','dujiao','generic_html','custom_html','public_json','merchant_feed']) {
    registry.get(kind)!.probe = async () => { fallback++; throw new Error('unexpected_fallback'); };
  }
  for (const reason of ['waf_challenge:wzyp.cn:test','platform_deferred:2026-09-10T00:00:00.000Z:daily_budget','shop_api_rejected:店铺链接不存在']) {
    registry.get('shop_api')!.probe = async () => ({ supported: false, collectorKind: 'shop_api', confidence: 0.1, evidence: [], reason });
    const result = await registry.probe(new URL('https://wzyp.cn/shop/a'), new AbortController().signal);
    assert.equal(result.length, 1);
    assert.equal(result[0]!.reason, reason);
  }
  assert.equal(fallback, 0);
});
