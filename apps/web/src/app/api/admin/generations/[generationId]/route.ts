import { NextResponse } from "next/server";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { rollbackAdminGeneration } from "@/lib/admin-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: { params: Promise<{ generationId: string }> }) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || session.role !== "system_admin") return Response.json({ error: "forbidden" }, { status: 403 });
  const { generationId } = await params;
  const form = await request.formData();
  const reason = form.get("reason");
  if (!UUID.test(generationId) || typeof reason !== "string" || reason.trim().length < 4 || reason.length > 500) return Response.json({ error: "invalid_rollback" }, { status: 400 });
  try { await rollbackAdminGeneration({ generationId, reason: reason.trim(), actorId: session.sub }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "rollback_failed" }, { status: 409 }); }
  return NextResponse.redirect(new URL("/admin/generations", request.url), 303);
}
