import { NextResponse } from "next/server";
import { z } from "zod";
import { requestHasSameOrigin } from "@/lib/admin-auth";
import { createMerchantFeedApplication, submissionFingerprint } from "@/lib/public-submissions";

const schema = z.object({ merchantName: z.string().trim().min(2).max(120), websiteUrl: z.url().max(500), feedUrl: z.url().max(500), schemaKind: z.enum(["price-radar-v1", "auto"]), contact: z.string().trim().min(2).max(200), notes: z.string().trim().max(2000).optional(), companySite: z.string().max(0) });

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const form = await request.formData();
  const parsed = schema.safeParse({ merchantName: form.get("merchantName"), websiteUrl: form.get("websiteUrl"), feedUrl: form.get("feedUrl"), schemaKind: form.get("schemaKind"), contact: form.get("contact"), notes: form.get("notes") || undefined, companySite: form.get("companySite") ?? "" });
  if (!parsed.success) return Response.json({ error: "invalid_feed_application" }, { status: 400 });
  try {
    const { notes, companySite: _companySite, ...required } = parsed.data;
    const id = await createMerchantFeedApplication({ ...required, ...(notes ? { notes } : {}), fingerprint: submissionFingerprint(request) });
    return NextResponse.redirect(new URL(`/submit/status?id=${id}`, request.url), 303);
  }
  catch (error) { const message = error instanceof Error ? error.message : "feed_application_failed"; return Response.json({ error: message }, { status: message === "submission_rate_limited" ? 429 : 400 }); }
}
