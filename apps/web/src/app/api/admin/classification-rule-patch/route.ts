import { getAdminRequestSession } from "@/lib/admin-auth";
import { getClassificationRulePatch } from "@/lib/admin-data";

export async function GET(request: Request) {
  const session = getAdminRequestSession(request);
  if (!session || !["system_admin", "reviewer"].includes(session.role)) return Response.json({ error: "forbidden" }, { status: 403 });
  return Response.json(await getClassificationRulePatch(), { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="classification-rule-patch-${new Date().toISOString().slice(0, 10)}.json"`, "X-Content-Type-Options": "nosniff" } });
}
