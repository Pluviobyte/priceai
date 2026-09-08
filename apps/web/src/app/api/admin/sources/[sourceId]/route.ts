import { NextResponse } from "next/server";
import { getAdminRequestSession, requestHasSameOrigin } from "@/lib/admin-auth";
import { updateAdminSource } from "@/lib/admin-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "operations"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  const { sourceId } = await params;
  const form = await request.formData();
  const action = form.get("action");
  const reason = form.get("reason");
  if (
    (action !== "enable" && action !== "pause" && action !== "retry" && action !== "remove" && action !== "switch") ||
    typeof reason !== "string" ||
    reason.length < 2
  ) {
    return Response.json({ error: "invalid_source_action" }, { status: 400 });
  }
  const collectorKind = form.get("collectorKind");
  const allowedCollectors = ["shop_api", "shop_api_16688", "kami", "dujiao", "public_json", "generic_html", "custom_html", "browser", "merchant_feed"];
  if (action === "switch" && (typeof collectorKind !== "string" || !allowedCollectors.includes(collectorKind))) return Response.json({ error: "invalid_collector" }, { status: 400 });
  await updateAdminSource({ sourceId, action, reason, actorId: session.sub, ...(typeof collectorKind === "string" ? { collectorKind } : {}) });
  return NextResponse.redirect(new URL("/admin/sources", request.url), 303);
}
