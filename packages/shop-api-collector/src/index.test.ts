import test from 'node:test';
import assert from 'node:assert/strict';
import { HostThrottle } from '@price-radar/collector-sdk';
import { LdxpShopApiCollector } from './index.js';

test('HTTP 200 WAF HTML is an access challenge and does not trigger mirror retries', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('<script>window._waf_is_mobile=false</script>', { headers: { 'content-type': 'text/html' } }); };
  try {
    const collector = new LdxpShopApiCollector({ throttle: new HostThrottle({ minIntervalMs: 0, jitterMs: 0 }) });
    const result = await collector.probe(new URL('https://wzyp.cn/shop/example'), new AbortController().signal);
    assert.equal(result.supported, false);
    assert.equal(result.reason, 'shop_api_access_challenge');
    assert.equal(requests, 1);
  } finally { globalThis.fetch = original; }
});
