import { NextResponse } from "next/server";
import { z } from "zod";
import { requestHasSameOrigin } from "@/lib/admin-auth";
import {
  createPublicSourceSubmission,
  submissionFingerprint,
} from "@/lib/public-submissions";

const submissionSchema = z.object({
  url: z.string().trim().min(8).max(2_048),
  name: z.string().trim().max(120).optional(),
  contact: z.string().trim().max(200).optional(),
  primaryProducts: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2_000).optional(),
  website: z.string().max(0),
});

function normalizeSubmissionUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid_url_protocol");
  }
  if (url.username || url.password) throw new Error("url_credentials_not_allowed");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("url_port_not_allowed");
  }
  url.hash = "";
  return url.toString();
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return Response.json({ error: "origin_mismatch" }, { status: 403 });
  }
  const form = await request.formData();
  const parsed = submissionSchema.safeParse({
    url: form.get("url"),
    name: form.get("name") || undefined,
    contact: form.get("contact") || undefined,
    primaryProducts: form.get("primaryProducts") || undefined,
    notes: form.get("notes") || undefined,
    website: form.get("website") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/submit?error=invalid", request.url), 303);
  }

  try {
    const result = await createPublicSourceSubmission({
      url: normalizeSubmissionUrl(parsed.data.url),
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.contact ? { contact: parsed.data.contact } : {}),
      ...(parsed.data.primaryProducts ? { primaryProducts: parsed.data.primaryProducts } : {}),
      ...(parsed.data.notes ? { notes: parsed.data.notes } : {}),
      fingerprint: submissionFingerprint(request),
    });
    return NextResponse.redirect(
      new URL(`/submit/status?id=${encodeURIComponent(result.id)}`, request.url),
      303,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const code = message === "submission_rate_limited" ? "rate" : "invalid";
    return NextResponse.redirect(new URL(`/submit?error=${code}`, request.url), 303);
  }
}
