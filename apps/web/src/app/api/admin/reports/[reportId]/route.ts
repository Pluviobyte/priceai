import { NextResponse } from "next/server";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { resolveAdminReport } from "@/lib/admin-data";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "reviewer"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const { reportId } = await params;
  const form = await request.formData();
  const action = form.get("action");
  const resolution = form.get("resolution");
  if ((action !== "resolve" && action !== "dismiss" && action !== "quarantine") || typeof resolution !== "string" || resolution.trim().length < 2) return Response.json({ error: "invalid_report_action" }, { status: 400 });
  await resolveAdminReport({ reportId, action, resolution: resolution.trim(), actorId: session.sub });
  return NextResponse.redirect(new URL("/admin/reports", request.url), 303);
}
