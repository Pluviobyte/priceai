import { setTimeout as delay } from 'node:timers/promises';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const routes = new Set(['/shopApi/Shop/info', '/shopApi/Shop/goodsList', '/shopApi/Shop/goodsInfo']);
export function validateRequest(input) {
  const url = new URL(input.url);
  if (url.origin !== 'https://wzyp.cn' || !routes.has(url.pathname) || url.search || url.hash || url.username || url.password) throw new Error('target_not_allowed');
  if (typeof input.body !== 'string' || input.body.length > 8192) throw new Error('body_not_allowed');
  const body = JSON.parse(input.body);
  const allowed = url.pathname.endsWith('goodsInfo') ? ['goods_key'] : url.pathname.endsWith('goodsList') ? ['token', 'goods_type', 'current', 'pageSize'] : ['token'];
  if (!body || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) throw new Error('body_not_allowed');
  const key = body.token ?? body.goods_key;
  if (typeof key !== 'string' || !key.length || key.length > 128 || /[\x00-\x1f]/.test(key)) throw new Error('shop_key_invalid');
  if (url.pathname.endsWith('goodsList') && (!['card','article','resource','equity'].includes(body.goods_type) || !Number.isInteger(body.current) || body.current < 1 || body.current > 1000 || !Number.isInteger(body.pageSize) || body.pageSize < 1 || body.pageSize > 100)) throw new Error('pagination_invalid');
  return { url, body: input.body };
}
export function relayIntervalMs(env = process.env) {
  const value = Number(env.COLLECTOR_CN_INTERVAL_MS ?? 5000);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error('invalid_relay_interval');
  return value;
}
export function createEgressServer({ token, intervalMs = 5000, fetchImpl = fetch }) {
  if (!token || token.length < 32) throw new Error('relay_token_required');
  let busy = false, nextAt = 0;
  return createServer(async (req, res) => {
    const reply = (status, data) => { res.writeHead(status, {'content-type':'application/json'}); res.end(JSON.stringify(data)); };
    const auth = Buffer.from(req.headers.authorization ?? '');
    const expected = Buffer.from(`Bearer ${token}`);
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return reply(401,{error:'unauthorized'});
    if (req.url === '/health' && req.method === 'GET') return reply(200,{ok:true,egress:'hangzhou'});
    if (req.url !== '/fetch' || req.method !== 'POST') return reply(404,{error:'not_found'});
    if (busy) return reply(429,{error:'rate_limited'});
    busy = true;
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req) { size += chunk.length; if (size > 16384) throw new Error('request_too_large'); chunks.push(chunk); }
      const target = validateRequest(JSON.parse(Buffer.concat(chunks).toString()));
      await delay(Math.max(0, nextAt - Date.now()));
      nextAt = Date.now() + intervalMs;
      const response = await fetchImpl(target.url, { method:'POST', body:target.body, redirect:'error', headers:{'content-type':'application/json',accept:'application/json','user-agent':'PriceAI/0.1 (+https://priceai.io)'}, signal:AbortSignal.timeout(15_000) });
      const parts=[]; let bytes=0;
      for await (const chunk of response.body ?? []) { bytes+=chunk.length; if(bytes>8*1024*1024) throw new Error('response_too_large'); parts.push(chunk); }
      const headers={}; for(const h of ['content-type','retry-after','server']) if(response.headers.has(h)) headers[h]=response.headers.get(h);
      reply(200,{status:response.status,headers,body:Buffer.concat(parts).toString()});
      console.log(JSON.stringify({event:'egress_request',path:target.url.pathname,status:response.status,bytes}));
    } catch(error) { reply(502,{error:'egress_request_failed'}); console.error(JSON.stringify({event:'egress_failed',reason:error.message})); }
    finally { busy=false; }
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const intervalMs = relayIntervalMs();
  const server = createEgressServer({token:process.env.COLLECTOR_CN_TOKEN, intervalMs});
  console.log(JSON.stringify({event:'egress_started',intervalMs}));
  server.requestTimeout=20_000; server.headersTimeout=10_000;
  server.listen(Number(process.env.PORT ?? 17890),'127.0.0.1');
  for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>process.exit(0)));
}
