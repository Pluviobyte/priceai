import { NextResponse } from "next/server";
import { isAdminRequest, requestHasSameOrigin } from "@/lib/admin-auth";
import { reviewAdminSubmission } from "@/lib/admin-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  if (!isAdminRequest(request)) return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  const { submissionId } = await params;
  const form = await request.formData();
  const action = form.get("action");
  const reason = form.get("reason");
  if (
    (action !== "retry" && action !== "approve" && action !== "reject") ||
    typeof reason !== "string" || reason.trim().length < 2
  ) {
    return Response.json({ error: "invalid_submission_action" }, { status: 400 });
  }
  try {
    await reviewAdminSubmission({
      submissionId,
      action,
      reason: reason.trim(),
      actorId: "admin",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "submission_action_failed";
    const status = message === "complete_trial_required" ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
  return NextResponse.redirect(new URL("/admin/submissions", request.url), 303);
}
