import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function blockedIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) return true;
  const [a = 0, b = 0] = octets;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) || (a === 198 && b >= 18 && b <= 19) ||
    (a === 203 && b === 0) || a >= 224;
}

function publicIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !blockedIpv4(address);
  if (version !== 6) return false;
  const value = address.toLowerCase().split("%")[0] ?? "";
  if (value === "::" || value === "::1" || value.startsWith("2001:db8:") || value.startsWith("100::")) return false;
  if (value.startsWith("::ffff:")) return !blockedIpv4(value.slice(7));
  const first = Number.parseInt(value.split(":")[0] ?? "", 16);
  return Number.isFinite(first) && (first & 0xfe00) !== 0xfc00 && (first & 0xffc0) !== 0xfe80 && (first & 0xff00) !== 0xff00;
}

function syntheticDnsIp(address: string): boolean {
  if (isIP(address) === 4) {
    const [first = 0, second = 0] = address.split(".").map(Number);
    return first === 198 && (second === 18 || second === 19);
  }
  return address.toLowerCase().startsWith("fdfe:dcba:9876:");
}

export async function safeModelEndpoint(input: string): Promise<URL> {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("endpoint_not_allowed");
  url.hash = "";
  const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
  if (!hostname || hostname === "localhost" || [".local", ".internal", ".test", ".invalid"].some((suffix) => hostname.endsWith(suffix))) throw new Error("endpoint_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  const allowSynthetic = process.env.ALLOW_LOCAL_SYNTHETIC_DNS === "true" && process.env.NODE_ENV !== "production";
  if (!addresses.length || addresses.length > 16 || addresses.some(({ address }) => !publicIp(address) && !(allowSynthetic && syntheticDnsIp(address)))) throw new Error("endpoint_private_address");
  return url;
}

async function boundedJson(url: string, init: RequestInit): Promise<{ payload: unknown; status: number; latencyMs: number }> {
  const started = performance.now();
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000) });
  const latencyMs = Math.round(performance.now() - started);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > 5_000_000) throw new Error("response_too_large");
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error("response_too_large");
  if (!response.ok) throw new Error(`upstream_http_${response.status}`);
  return { payload: JSON.parse(text) as unknown, status: response.status, latencyMs };
}

export async function runOneTimeModelCheck(input: { endpoint: URL; apiKey: string; model?: string }) {
  const base = input.endpoint.toString().replace(/\/$/, "");
  const modelBase = base.replace(/\/models$/, "");
  const modelsUrl = base.endsWith("/models") ? base : `${base}/models`;
  const headers = { authorization: `Bearer ${input.apiKey}`, accept: "application/json", "user-agent": "AIPriceRadar/0.1 (+one-time-user-key-check)" };
  const catalog = await boundedJson(modelsUrl, { headers });
  const payload = catalog.payload && typeof catalog.payload === "object" ? catalog.payload as { data?: unknown } : {};
  const data = Array.isArray(payload.data) ? payload.data : [];
  const models = data.map((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string" ? (item as { id: string }).id : "").filter(Boolean);
  const result: { endpoint: string; modelCount: number; models: string[]; latencyMs: number; test?: { model: string; success: boolean; latencyMs: number; status: number } } = { endpoint: input.endpoint.origin, modelCount: models.length, models: models.slice(0, 100), latencyMs: catalog.latencyMs };
  if (input.model) {
    const started = performance.now();
    const response = await fetch(`${modelBase}/chat/completions`, { method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000), headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify({ model: input.model, messages: [{ role: "user", content: "Reply OK" }], max_tokens: 1, stream: false }) });
    await response.body?.cancel();
    result.test = { model: input.model, success: response.ok, latencyMs: Math.round(performance.now() - started), status: response.status };
  }
  return result;
}
