import { NextResponse } from "next/server";
import { authCookieOptions, authOrigin, LOGIN_COOKIE, USER_COOKIE } from "@/lib/user-auth";

export async function POST(request: Request) {
  if (request.headers.get("origin") !== authOrigin()) return new Response("Forbidden", { status: 403 });
  const response = NextResponse.redirect(new URL("/login", authOrigin()), 303);
  response.headers.set("Cache-Control", "no-store");
  for (const name of [USER_COOKIE, LOGIN_COOKIE]) response.cookies.set(name, "", { ...authCookieOptions, maxAge: 0 });
  return response;
}
