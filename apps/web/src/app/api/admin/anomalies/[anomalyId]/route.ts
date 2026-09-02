import { NextResponse } from "next/server";
import { isAdminRequest, requestHasSameOrigin } from "@/lib/admin-auth";
import { resolveAdminAnomaly } from "@/lib/admin-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ anomalyId: string }> },
) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  if (!isAdminRequest(request)) return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  const { anomalyId } = await params;
  const form = await request.formData();
  const action = form.get("action");
  const reason = form.get("reason");
  if (
    (action !== "resolve" && action !== "ignore") ||
    typeof reason !== "string" ||
    reason.trim().length < 2
  ) {
    return Response.json({ error: "invalid_anomaly_action" }, { status: 400 });
  }
  await resolveAdminAnomaly({
    anomalyId,
    action,
    reason: reason.trim(),
    actorId: "admin",
  });
  return NextResponse.redirect(new URL("/admin/anomalies", request.url), 303);
}
