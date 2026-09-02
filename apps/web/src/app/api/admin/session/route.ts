import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  createAdminToken,
  requestHasSameOrigin,
  verifyAdminCredentials,
} from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return Response.json({ error: "origin_mismatch" }, { status: 403 });
  }
  const form = await request.formData();
  const username = form.get("username");
  const password = form.get("password");
  const session = typeof username === "string" && typeof password === "string" ? verifyAdminCredentials(username, password) : null;
  if (!session) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url), 303);
  }
  let token: string;
  try {
    token = createAdminToken(session);
  } catch {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url), 303);
  }
  const response = NextResponse.redirect(new URL("/admin", request.url), 303);
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 8 * 60 * 60,
    priority: "high",
  });
  return response;
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
