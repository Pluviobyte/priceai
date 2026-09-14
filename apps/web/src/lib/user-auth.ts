import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { EncryptJWT, jwtDecrypt, type JWTPayload } from "jose";

export type LoginProvider = "google" | "github";
export interface UserSession { provider: LoginProvider; id: string; name: string; email: string | null }
export interface LoginAttempt { provider: LoginProvider; state: string; verifier: string; next: string }
export const USER_SESSION_SECONDS = 7 * 24 * 60 * 60;
export const LOGIN_ATTEMPT_SECONDS = 10 * 60;
export const USER_COOKIE = process.env.NODE_ENV === "production" ? "__Host-priceai_user" : "priceai_user";
export const LOGIN_COOKIE = process.env.NODE_ENV === "production" ? "__Host-priceai_login" : "priceai_login";
export const authCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };

export function isLoginProvider(value: unknown): value is LoginProvider { return value === "google" || value === "github"; }
export function authOrigin(): string {
  const url = new URL(process.env.PUBLIC_BASE_URL ?? "http://localhost:3000");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("auth_origin_not_secure");
  return url.origin;
}
export function safeLoginNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return "/account";
  const parsed = new URL(value, "https://priceai.invalid");
  if (parsed.origin !== "https://priceai.invalid" || /^\/(?:api|admin|login)(?:\/|$)/.test(parsed.pathname)) return "/account";
  return parsed.pathname + parsed.search + parsed.hash;
}
function key() {
  const secret = process.env.USER_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("user_session_secret_not_configured");
  return createHash("sha256").update(secret).digest();
}
export function providerConfig(provider: LoginProvider) {
  const prefix = provider === "google" ? "GOOGLE" : "GITHUB";
  const clientId = process.env[`${prefix}_CLIENT_ID`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error("oauth_not_configured");
  return { clientId, clientSecret, redirectUri: `${authOrigin()}/api/auth/${provider}/callback` };
}
export function loginProviderReady(provider: LoginProvider): boolean {
  try { key(); providerConfig(provider); return true; } catch { return false; }
}
async function seal(payload: JWTPayload, purpose: string, seconds: number, now = new Date()) {
  const issued = Math.floor(now.getTime() / 1000);
  return new EncryptJWT(payload).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuer("priceai").setAudience(purpose).setIssuedAt(issued).setExpirationTime(issued + seconds).encrypt(key());
}
async function unseal(token: string | undefined, purpose: string, now = new Date()) {
  if (!token || token.length > 4096) return null;
  try {
    return (await jwtDecrypt(token, key(), { issuer: "priceai", audience: purpose, currentDate: now,
      keyManagementAlgorithms: ["dir"], contentEncryptionAlgorithms: ["A256GCM"] })).payload;
  } catch { return null; }
}
export async function createUserToken(user: UserSession, now?: Date) {
  return seal({ ...user }, "user-session", USER_SESSION_SECONDS, now);
}
export async function readUserToken(token: string | undefined, now?: Date): Promise<UserSession | null> {
  const payload = await unseal(token, "user-session", now);
  if (!payload || !isLoginProvider(payload.provider) || typeof payload.id !== "string" || !payload.id ||
      typeof payload.name !== "string" || !(payload.email === null || typeof payload.email === "string")) return null;
  return { provider: payload.provider, id: payload.id, name: payload.name, email: payload.email };
}
export async function createLoginAttempt(provider: LoginProvider, next: unknown) {
  const attempt: LoginAttempt = { provider, next: safeLoginNext(next), state: randomBytes(32).toString("base64url"), verifier: randomBytes(32).toString("base64url") };
  const cookie = await seal({ ...attempt }, "login-attempt", LOGIN_ATTEMPT_SECONDS);
  const { clientId, redirectUri } = providerConfig(provider);
  const url = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://github.com/login/oauth/authorize");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code",
    scope: provider === "google" ? "openid email profile" : "user:email", state: attempt.state,
    code_challenge: createHash("sha256").update(attempt.verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
  return { cookie, url, attempt };
}
export async function readLoginAttempt(token: string | undefined, provider: LoginProvider, state: string | null): Promise<LoginAttempt | null> {
  const p = await unseal(token, "login-attempt");
  if (!p || p.provider !== provider || typeof p.state !== "string" || !state || typeof p.verifier !== "string" || typeof p.next !== "string") return null;
  const a = Buffer.from(state), b = Buffer.from(p.state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return { provider, state, verifier: p.verifier, next: safeLoginNext(p.next) };
}
async function fetchJson(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(url, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("oauth_upstream_failed");
  return response.json();
}
export async function exchangeLoginCode(attempt: LoginAttempt, code: string): Promise<UserSession> {
  const { clientId, clientSecret, redirectUri } = providerConfig(attempt.provider);
  const tokens = await fetchJson(attempt.provider === "google" ? "https://oauth2.googleapis.com/token" : "https://github.com/login/oauth/access_token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
      code, code_verifier: attempt.verifier, grant_type: "authorization_code" }),
  });
  if (typeof tokens.access_token !== "string" || !tokens.access_token || tokens.error) throw new Error("oauth_exchange_failed");
  const headers = { Authorization: `Bearer ${tokens.access_token}`, Accept: "application/json", "User-Agent": "PriceAI" };
  // Fetch the identity directly from the provider; never trust an unverified ID token or an email as an account ID.
  const user = await fetchJson(attempt.provider === "google" ? "https://openidconnect.googleapis.com/v1/userinfo" : "https://api.github.com/user", { headers });
  if (attempt.provider === "google") {
    if (typeof user.sub !== "string" || !user.sub || user.email_verified !== true || typeof user.email !== "string") throw new Error("oauth_identity_invalid");
    return { provider: "google", id: user.sub, name: String(user.name || user.email).slice(0, 160), email: user.email.slice(0, 320) };
  }
  if (!Number.isSafeInteger(user.id) || typeof user.login !== "string") throw new Error("oauth_identity_invalid");
  const response = await fetch("https://api.github.com/user/emails", { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("oauth_email_failed");
  const emails: unknown = await response.json();
  const verified = Array.isArray(emails) ? emails.find((e) => e && e.primary === true && e.verified === true && typeof e.email === "string") : null;
  return { provider: "github", id: String(user.id), name: String(user.name || user.login).slice(0, 160), email: verified?.email.slice(0, 320) ?? null };
}
