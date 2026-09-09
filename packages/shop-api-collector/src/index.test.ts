import test from 'node:test';
import assert from 'node:assert/strict';
import { HostThrottle } from '@price-radar/collector-sdk';
import { LdxpShopApiCollector } from './index.js';

test('HTTP 200 WAF HTML is an access challenge and does not trigger mirror retries', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('<html><head><script id="x" captchaType="esa"></script></head></html>', { headers: { 'content-type': 'text/html' } }); };
  try {
    const collector = new LdxpShopApiCollector({ throttle: new HostThrottle({ minIntervalMs: 0, jitterMs: 0 }) });
    const result = await collector.probe(new URL('https://wzyp.cn/shop/example'), new AbortController().signal);
    assert.equal(result.supported, false);
    assert.match(result.reason ?? '', /waf_challenge/);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = original; }
});

test('HTTP 403 WAF is classified before status handling and does not fan out to mirrors', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('<script>window._waf_challenge = true</script>', { status: 403, headers: { 'content-type': 'text/html' } }); };
  try {
    const collector = new LdxpShopApiCollector({ throttle: new HostThrottle({ minIntervalMs: 0, jitterMs: 0 }) });
    const result = await collector.probe(new URL('https://wzyp.cn/shop/example'), new AbortController().signal);
    assert.match(result.reason ?? '', /waf_challenge/);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = original; }
});

test('429 Retry-After is a scheduled deferral, not a mirror retry', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return new Response('{}', { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '120' } }); };
  try {
    const collector = new LdxpShopApiCollector({ throttle: new HostThrottle({ minIntervalMs: 0, jitterMs: 0 }) });
    const result = await collector.probe(new URL('https://wzyp.cn/shop/example'), new AbortController().signal);
    assert.match(result.reason ?? '', /platform_deferred:.*:server_retry_after/);
    assert.equal(requests, 1);
  } finally { globalThis.fetch = original; }
});
