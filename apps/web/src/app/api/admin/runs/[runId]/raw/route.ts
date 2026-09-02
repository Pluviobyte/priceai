import { createHash } from "node:crypto";
import { isAdminRequest } from "@/lib/admin-auth";
import { query } from "@/lib/database";
import { rawObjectStore } from "@/lib/raw-object-storage";

export async function GET(request: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!isAdminRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { runId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)) {
    return Response.json({ error: "invalid_run_id" }, { status: 400 });
  }
  const [run] = await query<{ raw_manifest_url: string | null; raw_manifest_hash: string | null }>(
    "select raw_manifest_url,raw_manifest_hash from crawl_runs where id=$1 limit 1",
    [runId],
  );
  if (!run?.raw_manifest_url) return Response.json({ error: "raw_manifest_not_available" }, { status: 404 });
  const bytes = await rawObjectStore.getBytes(run.raw_manifest_url);
  const actualHash = createHash("sha256").update(bytes).digest("hex");
  if (run.raw_manifest_hash && actualHash !== run.raw_manifest_hash) {
    return Response.json({ error: "raw_manifest_hash_mismatch" }, { status: 409 });
  }
  const body = Uint8Array.from(bytes).buffer;
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `inline; filename="crawl-run-${runId}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Manifest-SHA256": actualHash,
    },
  });
}
