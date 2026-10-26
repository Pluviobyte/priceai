import { NextResponse } from "next/server";
import { z } from "zod";
import { requestHasSameOrigin } from "@/lib/admin-auth";
import { submissionFingerprint } from "@/lib/public-submissions";
import { createSiteInquiry, INQUIRY_KINDS, inquiryKind } from "@/lib/site-inquiries";

const inquirySchema = z.object({
  kind: z.enum(Object.keys(INQUIRY_KINDS) as [keyof typeof INQUIRY_KINDS, ...Array<keyof typeof INQUIRY_KINDS>]),
  name: z.string().trim().max(120).optional(),
  contact: z.string().trim().min(3).max(200),
  message: z.string().trim().min(5).max(3_000),
  website: z.string().max(0),
});

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const form = await request.formData();
  const kind = inquiryKind(String(form.get("kind") ?? ""));
  const parsed = inquirySchema.safeParse({
    kind,
    name: form.get("name") || undefined,
    contact: form.get("contact") ?? "",
    message: form.get("message") ?? "",
    website: form.get("website") ?? "",
  });
  if (!parsed.success) return NextResponse.redirect(new URL(`/contact?kind=${kind}&error=invalid`, request.url), 303);
  try {
    await createSiteInquiry({
      kind: parsed.data.kind,
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      contact: parsed.data.contact,
      message: parsed.data.message,
      fingerprint: submissionFingerprint(request),
    });
    return NextResponse.redirect(new URL(`/contact?kind=${kind}&sent=1`, request.url), 303);
  } catch (error) {
    const code = error instanceof Error && error.message === "inquiry_rate_limited" ? "rate" : "invalid";
    return NextResponse.redirect(new URL(`/contact?kind=${kind}&error=${code}`, request.url), 303);
  }
}
