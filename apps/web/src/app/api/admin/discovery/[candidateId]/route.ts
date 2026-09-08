import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { reviewSourceCandidate } from "@/lib/admin-data";

const inputSchema = z.object({ candidateId: z.string().uuid(), action: z.enum(["precheck", "adapter", "reject", "requeue"]), reason: z.string().trim().min(2).max(500) });
export async function POST(request: Request, { params }: { params: Promise<{ candidateId: string }> }) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "operations"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const form = await request.formData();
  const parsed = inputSchema.safeParse({ ...(await params), action: form.get("action"), reason: form.get("reason") });
  if (!parsed.success) return Response.json({ error: "invalid_candidate_action" }, { status: 400 });
  await reviewSourceCandidate({ ...parsed.data, actorId: session.sub });
  return NextResponse.redirect(new URL("/admin/discovery", request.url), 303);
}
