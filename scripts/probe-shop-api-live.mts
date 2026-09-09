/** Read-only live smoke test; no database or production writes.
 * node --import tsx scripts/probe-shop-api-live.mts [output.json] [shop-or-item URLs...]
 */
import { writeFile } from 'node:fs/promises';
import { LdxpShopApiCollector } from '@price-radar/shop-api-collector';
import { HostThrottle } from '@price-radar/collector-sdk';
const output = process.argv[2] ?? '/tmp/price-radar-shop-api-live.json';
const urls = process.argv.slice(3);
if (!urls.length) urls.push('https://wzyp.cn/shop/2VWX76A4', 'https://wzyp.cn/item/84qh0k', 'https://catfk.com/shop/YIXOQD2E');
const requests: unknown[] = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const start = Date.now();
  try {
    const response = await nativeFetch(input, init);
    requests.push({url: String(input), status: response.status, contentType: response.headers.get('content-type'), server: response.headers.get('server'), ms: Date.now() - start});
    return response;
  } catch (error) {
    requests.push({url: String(input), error: String(error), ms: Date.now() - start});
    throw error;
  }
};
const results: unknown[] = [];
for (const url of urls) {
  const collector = new LdxpShopApiCollector({throttle: new HostThrottle({minIntervalMs: 1200, maxConcurrency: 1, jitterMs: 300})});
  const context = {sourceId: 'read-only-live-probe', now: new Date(), signal: AbortSignal.timeout(120_000)};
  const pages = [];
  const offers = [];
  try {
    const identity = await collector.resolveSourceIdentity(new URL(url), context.signal);
    let cursor: string | undefined;
    do {
      if (pages.length >= 20) throw new Error('smoke_test_page_limit');
      const page = await collector.fetchCatalog(identity, context, cursor);
      pages.push(page);
      for (const item of page.items) offers.push(collector.normalizeItem(item, context));
      cursor = page.nextCursor;
    } while (cursor);
    const result = {url, merchantName: identity.merchantName, canonicalEntryUrl: identity.canonicalEntryUrl, validation: collector.validateSnapshot(pages), pageCount: pages.length, inStock: offers.filter(o => o.stockState === 'in_stock').length, offers};
    results.push(result);
    console.log(JSON.stringify({...result, offers: offers.slice(0, 3).map(o => ({title: o.rawTitle, price: o.price, stockCount: o.stockCount, url: o.productUrl}))}, null, 2));
  } catch (error) {
    const result = {url, error: String(error), pagesCompleted: pages.length, offers};
    results.push(result);
    console.log(JSON.stringify({...result, offers: offers.length}));
  }
  await writeFile(output, JSON.stringify({capturedAt: new Date().toISOString(), runtime: process.version, requests, results}, null, 2));
}
console.log(`Evidence saved: ${output}`);
