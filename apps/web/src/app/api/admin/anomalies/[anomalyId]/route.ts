import { NextResponse } from "next/server";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { resolveAdminAnomaly } from "@/lib/admin-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ anomalyId: string }> },
) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "reviewer"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
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
    actorId: session.sub,
  });
  return NextResponse.redirect(new URL("/admin/anomalies", request.url), 303);
}
