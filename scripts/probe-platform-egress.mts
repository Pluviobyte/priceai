/** Read-only live adapter probe. No database access; at most 8 HTTP requests per target. */
import { readFile, writeFile } from 'node:fs/promises';
import { LdxpShopApiCollector } from '@price-radar/shop-api-collector';
import { Sixteen688ShopCollector } from '@price-radar/shop-api-16688-collector';
import { DujiaoCollector } from '@price-radar/dujiao-collector';
import { KamiCollector } from '@price-radar/kami-collector';
import { GenericHtmlCollector } from '@price-radar/generic-html-collector';

const [targetsFile, outputFile] = process.argv.slice(2);
if (!targetsFile || !outputFile) throw new Error('Usage: probe targets.json output.json');
const targets = JSON.parse(await readFile(targetsFile, 'utf8'));
const nativeFetch = globalThis.fetch;
const requests: any[] = [];
const results: any[] = [];
let targetUrl = '', requestCount = 0, queue = Promise.resolve();
const lastStart = new Map<string, number>();
globalThis.fetch = async (input, init) => {
  if (++requestCount > 8) throw new Error('probe_request_budget');
  const url = new URL(input instanceof Request ? input.url : String(input));
  const turn = queue.then(async () => {
    const delay = Math.max(0, (lastStart.get(url.hostname) ?? 0) + 5000 - Date.now());
    await new Promise(r => setTimeout(r, delay));
    init?.signal?.throwIfAborted();
    lastStart.set(url.hostname, Date.now());
  });
  queue = turn.catch(() => {});
  await turn;
  const start = Date.now();
  const entry: any = {target: targetUrl, url: url.toString(), method: init?.method ?? 'GET'};
  requests.push(entry);
  try {
    const response = await nativeFetch(input, {...init, signal: AbortSignal.any([AbortSignal.timeout(20000), ...(init?.signal ? [init.signal] : [])])});
    Object.assign(entry, {status: response.status, contentType: response.headers.get('content-type'), ms: Date.now() - start});
    const body = await response.clone().text();
    entry.bytes = Buffer.byteLength(body);
    entry.challenge = /captcha|_waf_|cf-chl-|访问验证|人机验证/i.test(body);
    if (!response.headers.get('content-type')?.includes('json')) entry.htmlTitle = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0, 150);
    return response;
  } catch (error) {
    entry.error = String(error) + ((error as any)?.cause ? ` cause=${String((error as any).cause)}` : '');
    throw error;
  }
};
for (const target of targets) {
  targetUrl = target.url; requestCount = 0;
  const result: any = {...target};
  const started = Date.now();
  const collector = target.kind === 'dujiao' ? new DujiaoCollector()
    : target.kind === 'kami' ? new KamiCollector()
    : target.kind === 'shop_api_16688' ? new Sixteen688ShopCollector()
    : target.kind === 'shop_api' ? new LdxpShopApiCollector()
    : new GenericHtmlCollector({maxProductLinks: 3, concurrency: 1});
  if (target.kind === 'generic_html') result.productLinkSampleLimit = 3;
  const signal = AbortSignal.timeout(100000);
  try {
    const identity = await collector.resolveSourceIdentity(new URL(target.url), signal);
    result.merchantName = identity.merchantName;
    const context = {sourceId: 'read-only-platform-egress-probe', now: new Date(), signal};
    const page = await collector.fetchCatalog(identity, context);
    result.items = page.items.length;
    result.expectedTotal = page.expectedTotal;
    result.hasMore = Boolean(page.nextCursor);
    const offers = page.items.map(item => collector.normalizeItem(item, context));
    result.normalized = offers.length;
    result.inStock = offers.filter(item => item.stockState === 'in_stock').length;
    result.sample = offers.slice(0, 2).map(item => ({title: item.rawTitle, price: item.price, url: item.productUrl}));
    result.status = offers.length ? 'products_ok' : 'reachable_empty';
  } catch (error) {
    result.status = 'failed';
    result.error = String(error) + ((error as any)?.cause ? ` cause=${String((error as any).cause)}` : '');
  }
  await queue;
  result.ms = Date.now() - started;
  results.push(result);
  await writeFile(outputFile, JSON.stringify({capturedAt: new Date().toISOString(),runtime:process.version,results,requests}, null, 2));
  console.log(JSON.stringify(result));
}
