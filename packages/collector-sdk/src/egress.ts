import { PlatformDeferredError } from './request-policy.js';

/** Route only explicitly assigned public hosts. A failed relay never falls back
 * to a different egress and silently contaminates its circuit/health history. */
export function createEgressFetch(env: NodeJS.ProcessEnv = process.env): typeof fetch {
  const hosts = new Set((env.COLLECTOR_CN_HOSTS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
  if (!hosts.size) return (input, init) => fetch(input, init);
  const endpoint = env.COLLECTOR_CN_ENDPOINT;
  const token = env.COLLECTOR_CN_TOKEN;
  if (!endpoint || !token) throw new Error('collector_cn_configuration_incomplete');
  const relay = new URL(endpoint);
  if (!['http:', 'https:'].includes(relay.protocol) || relay.username || relay.password) throw new Error('collector_cn_endpoint_invalid');
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (!hosts.has(url.hostname.toLowerCase())) return fetch(input, init);
    if (input instanceof Request || init?.method !== 'POST' || typeof init.body !== 'string') throw new Error('collector_cn_request_not_supported');
    try {
      const response = await fetch(relay, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.toString(), body: init.body }),
        signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(25_000)]),
        redirect: 'error',
      });
      if (!response.ok) throw new Error('relay_unavailable');
      const payload = await response.json() as { status: number; body: string; headers: Record<string, string> };
      if (!Number.isInteger(payload.status) || payload.status < 200 || payload.status > 599 || typeof payload.body !== 'string') throw new Error('relay_invalid_response');
      return new Response(payload.body, { status: payload.status, headers: payload.headers });
    } catch (error) {
      if (init.signal?.aborted) throw error;
      throw new PlatformDeferredError(new Date(Date.now() + 5 * 60_000), 'cn_egress_unavailable');
    }
  };
}
