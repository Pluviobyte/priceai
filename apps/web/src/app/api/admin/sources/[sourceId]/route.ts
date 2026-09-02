import { NextResponse } from "next/server";
import { isAdminRequest, requestHasSameOrigin } from "@/lib/admin-auth";
import { updateAdminSource } from "@/lib/admin-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  if (!isAdminRequest(request)) return NextResponse.redirect(new URL("/admin/login", request.url), 303);
  const { sourceId } = await params;
  const form = await request.formData();
  const action = form.get("action");
  const reason = form.get("reason");
  if (
    (action !== "enable" && action !== "pause" && action !== "retry") ||
    typeof reason !== "string" ||
    reason.length < 2
  ) {
    return Response.json({ error: "invalid_source_action" }, { status: 400 });
  }
  await updateAdminSource({ sourceId, action, reason, actorId: "admin" });
  return NextResponse.redirect(new URL("/admin/sources", request.url), 303);
}
