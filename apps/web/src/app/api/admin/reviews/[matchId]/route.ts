import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  requestHasSameOrigin,
  verifyAdminToken,
} from "@/lib/admin-auth";
import { saveReviewDecision } from "@/lib/admin-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  if (!requestHasSameOrigin(request)) {
    return Response.json({ error: "origin_mismatch" }, { status: 403 });
  }
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === ADMIN_COOKIE_NAME)?.[1];
  if (!verifyAdminToken(token)) {
    return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  }
  const { matchId } = await params;
  const form = await request.formData();
  const action = form.get("action");
  const reason = form.get("reason");
  const canonicalProductSlug = form.get("canonicalProductSlug");
  if (
    (action !== "approve" && action !== "reject" && action !== "correct") ||
    typeof reason !== "string" ||
    reason.trim().length < 2
  ) {
    return Response.json({ error: "invalid_review_decision" }, { status: 400 });
  }
  await saveReviewDecision({
    matchId,
    action,
    ...(typeof canonicalProductSlug === "string" && canonicalProductSlug
      ? { canonicalProductSlug }
      : {}),
    reason: reason.trim(),
    actorId: "admin",
  });
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
