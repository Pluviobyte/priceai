import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authCookieOptions, authOrigin, createUserToken, exchangeLoginCode, isLoginProvider, LOGIN_COOKIE, readLoginAttempt, USER_COOKIE, USER_SESSION_SECONDS } from "@/lib/user-auth";

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isLoginProvider(provider)) return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const attempt = await readLoginAttempt((await cookies()).get(LOGIN_COOKIE)?.value, provider, url.searchParams.get("state"));
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, authOrigin()), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(LOGIN_COOKIE, "", { ...authCookieOptions, maxAge: 0 });
    return response;
  };
  if (!attempt) return finish("/login?error=expired");
  const retry = `/login?next=${encodeURIComponent(attempt.next)}&error=`;
  if (url.searchParams.has("error")) return finish(`${retry}cancelled`);
  const code = url.searchParams.get("code");
  if (!code || code.length > 2048) return finish(`${retry}expired`);
  try {
    const user = await exchangeLoginCode(attempt, code);
    const token = await createUserToken(user);
    const response = finish(attempt.next);
    response.cookies.set(USER_COOKIE, token, { ...authCookieOptions, maxAge: USER_SESSION_SECONDS });
    return response;
  } catch {
    // Never log the code, token, provider response or credentials.
    return finish(`${retry}failed`);
  }
}
