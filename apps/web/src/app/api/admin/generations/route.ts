import { NextResponse } from "next/server";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { requestAdminPublication } from "@/lib/admin-data";

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || session.role !== "system_admin") return Response.json({ error: "forbidden" }, { status: 403 });
  const reason = (await request.formData()).get("reason");
  if (typeof reason !== "string" || reason.trim().length < 4 || reason.length > 500) return Response.json({ error: "invalid_publication_request" }, { status: 400 });
  try { await requestAdminPublication({ actorId: session.sub, reason: reason.trim() }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "publication_request_failed" }, { status: 409 }); }
  return NextResponse.redirect(new URL("/admin/generations", request.url), 303);
}
