import { NextResponse } from "next/server";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { saveBatchReviewDecision } from "@/lib/admin-data";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "reviewer"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData();
  const matchIds = form.getAll("matchIds").filter((value): value is string => typeof value === "string");
  const action = form.get("action");
  const canonicalProductSlug = form.get("canonicalProductSlug");
  const reason = form.get("reason");
  if (
    (action !== "approve" && action !== "reject" && action !== "correct") ||
    matchIds.length === 0 || matchIds.length > 100 ||
    typeof reason !== "string" || reason.trim().length < 2
  ) {
    return Response.json({ error: "invalid_batch_review" }, { status: 400 });
  }
  try {
    await saveBatchReviewDecision({
      matchIds,
      action,
      ...(typeof canonicalProductSlug === "string" && canonicalProductSlug
        ? { canonicalProductSlug }
        : {}),
      reason: reason.trim(),
      actorId: session.sub,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "batch_review_failed" },
      { status: 400 },
    );
  }
  return NextResponse.redirect(new URL("/admin", request.url), 303);
}
