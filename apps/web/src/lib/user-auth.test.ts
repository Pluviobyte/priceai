import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, test } from "node:test";
import { createLoginAttempt, createUserToken, exchangeLoginCode, loginProviderReady, readLoginAttempt, readUserToken, safeLoginNext } from "./user-auth";
import { readAdminToken } from "./admin-auth";

const saved = { ...process.env };
beforeEach(() => {
  process.env.USER_SESSION_SECRET = "test-user-secret-with-more-than-32-characters";
  process.env.ADMIN_SESSION_SECRET = "test-admin-secret-with-more-than-32-characters";
  process.env.PUBLIC_BASE_URL = "https://priceai.io";
  process.env.GOOGLE_CLIENT_ID = "test-google-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
  process.env.GITHUB_CLIENT_ID = "test-github-id";
  process.env.GITHUB_CLIENT_SECRET = "test-github-secret";
});
afterEach(() => { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved); });

test("only local public return URLs are accepted", () => {
  for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/\nevil", "/admin", "/admin/users", "/api/auth/logout", "/login", "/x/../admin"]) assert.equal(safeLoginNext(value), "/account");
  assert.equal(safeLoginNext("/channels?view=merchants&page=2"), "/channels?view=merchants&page=2");
});
test("user session is encrypted, expires, rejects tampering and never authenticates an admin", async () => {
  const user = { provider: "google" as const, id: "123", name: "Test", email: "test@example.com" };
  const now = new Date("2026-09-14T00:00:00Z");
  const token = await createUserToken(user, now);
  assert.deepEqual(await readUserToken(token, now), user);
  assert.equal(token.includes(user.email), false);
  assert.equal(await readUserToken(token, new Date("2026-09-22T00:00:00Z")), null);
  const pieces = token.split("."); pieces[3] = (pieces[3]!.startsWith("A") ? "B" : "A") + pieces[3]!.slice(1);
  assert.equal(await readUserToken(pieces.join("."), now), null);
  assert.equal(readAdminToken(token, now.getTime()), null);
  process.env.USER_SESSION_SECRET = "different-secret-with-more-than-32-characters";
  assert.equal(await readUserToken(token, now), null);
});
test("both OAuth providers use unique state, PKCE and exact callbacks; cookies cannot cross purposes or providers", async () => {
  for (const provider of ["google", "github"] as const) {
    const { cookie, attempt, url } = await createLoginAttempt(provider, "/channels");
    assert.equal(url.searchParams.get("redirect_uri"), `https://priceai.io/api/auth/${provider}/callback`);
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("code_challenge"), createHash("sha256").update(attempt.verifier).digest("base64url"));
    assert.equal(url.searchParams.get("scope"), provider === "google" ? "openid email profile" : "user:email");
    assert.equal(url.search.includes("test-google-secret"), false);
    assert.deepEqual(await readLoginAttempt(cookie, provider, attempt.state), attempt);
    assert.equal(await readLoginAttempt(cookie, provider, "forged"), null);
    assert.equal(await readLoginAttempt(cookie, provider === "google" ? "github" : "google", attempt.state), null);
    assert.equal(await readUserToken(cookie), null);
    assert.notEqual((await createLoginAttempt(provider, "/")).attempt.state, attempt.state);
  }
});
test("missing provider configuration disables sign-in", () => {
  assert.equal(loginProviderReady("google"), true);
  delete process.env.GOOGLE_CLIENT_SECRET;
  assert.equal(loginProviderReady("google"), false);
  assert.equal(loginProviderReady("github"), true);
  delete process.env.USER_SESSION_SECRET;
  assert.equal(loginProviderReady("github"), false);
});
test("Google identity is read from authenticated userinfo and requires verified email", async (t) => {
  const { attempt } = await createLoginAttempt("google", "/");
  const calls: string[] = [];
  let verified = true;
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    calls.push(url);
    assert.equal(init.cache, "no-store");
    if (url.endsWith("/token")) {
      assert.equal((init.body as URLSearchParams).get("code_verifier"), attempt.verifier);
      return Response.json({ access_token: "provider-token", id_token: "not-trusted" });
    }
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer provider-token");
    return Response.json({ sub: "stable-google-id", name: "Test", email: "test@example.com", email_verified: verified });
  });
  assert.deepEqual(await exchangeLoginCode(attempt, "test-code"), { provider: "google", id: "stable-google-id", name: "Test", email: "test@example.com" });
  assert.equal(calls[1], "https://openidconnect.googleapis.com/v1/userinfo");
  verified = false;
  await assert.rejects(() => exchangeLoginCode(attempt, "test-code"), /identity_invalid/);
});
test("GitHub uses stable ID and verified primary email, even when the public email is untrusted", async (t) => {
  const { attempt } = await createLoginAttempt("github", "/");
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (url.endsWith("access_token")) return Response.json({ access_token: "provider-token" });
    if (url.endsWith("/emails")) return Response.json([{ email: "wrong@example.com", primary: false, verified: true }, { email: "right@example.com", primary: true, verified: true }]);
    return Response.json({ id: 1234, login: "someone", name: null, email: "unverified@example.com" });
  });
  assert.deepEqual(await exchangeLoginCode(attempt, "test-code"), { provider: "github", id: "1234", name: "someone", email: "right@example.com" });
});
test("provider error and malformed identity cannot create a session", async (t) => {
  const { attempt } = await createLoginAttempt("github", "/");
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "bad_verification_code" }));
  await assert.rejects(() => exchangeLoginCode(attempt, "invalid"), /exchange_failed/);
});
