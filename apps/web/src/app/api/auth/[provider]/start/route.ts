import { NextResponse } from "next/server";
import { authCookieOptions, authOrigin, createLoginAttempt, isLoginProvider, LOGIN_ATTEMPT_SECONDS, LOGIN_COOKIE } from "@/lib/user-auth";

export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isLoginProvider(provider)) return new Response("Not found", { status: 404 });
  if (request.headers.get("origin") !== authOrigin()) return new Response("Forbidden", { status: 403 });
  const form = await request.formData();
  try {
    const { cookie, url } = await createLoginAttempt(provider, form.get("next"));
    const response = NextResponse.redirect(url, 303);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(LOGIN_COOKIE, cookie, { ...authCookieOptions, maxAge: LOGIN_ATTEMPT_SECONDS });
    return response;
  } catch {
    return NextResponse.redirect(new URL("/login?error=unavailable", authOrigin()), 303);
  }
}
