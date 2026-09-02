import { NextResponse } from "next/server";
import { z } from "zod";
import { runOneTimeModelCheck, safeModelEndpoint } from "@/lib/model-check";
import { requestHasSameOrigin } from "@/lib/admin-auth";
import { publicApiGuard } from "@/lib/public-api";

const inputSchema = z.object({
  endpoint: z.url().max(500),
  apiKey: z.string().min(1).max(4096),
  model: z.string().trim().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "origin_mismatch" }, { status: 403 });
  const limited = await publicApiGuard(request);
  if (limited) return limited;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_check_request" }, { status: 400 });
  try {
    const endpoint = await safeModelEndpoint(parsed.data.endpoint);
    const result = await runOneTimeModelCheck({ endpoint, apiKey: parsed.data.apiKey, ...(parsed.data.model ? { model: parsed.data.model } : {}) });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "model_check_failed";
    return NextResponse.json({ error: message }, { status: message.includes("private") || message.includes("not_allowed") ? 400 : 502 });
  }
}
