/**
 * Bot-mitigation (WAF) challenge detection shared by HTTP collectors.
 *
 * Chinese card-shop platforms front their public JSON APIs with edge WAFs
 * (notably Aliyun ESA). From a low-reputation egress IP the WAF answers with an
 * HTML JS-challenge page instead of the JSON catalog — often with HTTP 200, so
 * status alone is not enough. A challenge is not a broken adapter and not a dead
 * shop: it means this egress cannot reach this host right now. Callers turn it
 * into a distinct "blocked_egress" state so the source is parked, not retried
 * into failure and not pushed into the human adapter queue.
 */
export class WafChallengeError extends Error {
  readonly hostname: string;
  readonly signature: string;

  constructor(hostname: string, signature: string) {
    super(`waf_challenge:${hostname}:${signature}`);
    this.name = "WafChallengeError";
    this.hostname = hostname;
    this.signature = signature;
  }
}

export function isWafChallengeError(error: unknown): error is WafChallengeError {
  return error instanceof WafChallengeError || (error instanceof Error && error.name === "WafChallengeError");
}

/** True when an error message anywhere carries the WAF-challenge marker (probe reasons, stored trial errors). */
export function mentionsWafChallenge(value: string | null | undefined): boolean {
  return typeof value === "string" && value.includes("waf_challenge");
}

const CHALLENGE_BODY_MARKERS = [
  // Aliyun ESA / WAF
  'captchatype="esa"',
  "captchatype=esa",
  "acw_sc__v2",
  "acw_sc_v2",
  "aliyun_waf",
  "_waf_",
  "波纹验证",
  "滑动验证",
  "访问验证",
  "安全验证",
  // Cloudflare and generic challenge platforms
  "cf-chl-",
  "cf_chl",
  "challenge-platform",
  "just a moment",
  "turnstile",
  "checking your browser",
  "safety verification",
  "请开启 javascript",
  "please enable javascript",
];

/**
 * Returns a short signature when an unexpected non-JSON response looks like a
 * WAF challenge, or null when it is just an ordinary non-JSON body. Only call
 * this on responses where JSON was expected but not received; the working JSON
 * path (and legitimate HTML endpoints) must never reach here.
 */
export function wafChallengeSignature(headers: Headers, bodyText: string): string | null {
  const body = bodyText.slice(0, 8_000).toLowerCase();
  for (const marker of CHALLENGE_BODY_MARKERS) {
    if (body.includes(marker)) return marker.replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "") || "challenge";
  }
  // A tiny HTML shell that immediately sets a cookie and reloads is the classic
  // transparent challenge; treat an anti-crawl cookie on a non-JSON body as one.
  const setCookie = headers.get("set-cookie") ?? "";
  if (/acw_(?:tc|sc)|cdn_sec_tc/i.test(setCookie) && /<script|location\.(?:href|reload)|document\.cookie/i.test(body)) {
    return "acw_cookie_challenge";
  }
  return null;
}

/**
 * Reads the body of a non-JSON response and throws WafChallengeError when it is
 * a challenge; otherwise returns the body text so the caller can raise its own
 * "unexpected content type" error with the evidence in hand.
 */
export async function throwIfWafChallenge(response: Response, hostname: string): Promise<string> {
  const bodyText = await response.text().catch(() => "");
  const signature = wafChallengeSignature(response.headers, bodyText);
  if (signature) throw new WafChallengeError(hostname, signature);
  return bodyText;
}
