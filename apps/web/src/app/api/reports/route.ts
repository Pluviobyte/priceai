import { accountKey, currentAccount } from "@/lib/account";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestHasSameOrigin } from "@/lib/admin-auth";
import { createPublicReport } from "@/lib/public-reports";
import { submissionFingerprint } from "@/lib/public-submissions";

const reportTypes = [
  "wrong_price", "out_of_stock", "delisted", "misclassified",
  "merchant_unreachable", "misleading_description", "merchant_info_update", "merchant_opt_out",
] as const;

const schema = z.object({
  targetType: z.enum(["offer", "merchant"]),
  targetId: z.uuid(),
  reportType: z.enum(reportTypes),
  details: z.string().trim().min(2).max(1_200),
  evidenceUrl: z.string().trim().max(2_048).optional(),
  returnTo: z.string().max(500).default("/"),
  website: z.string().max(0),
});

function safeEvidenceUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("invalid_evidence_url");
  return url.toString();
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return Response.json({ error: "origin_mismatch" }, { status: 403 });
  const form = await request.formData();
  const parsed = schema.safeParse({
    targetType: form.get("targetType"), targetId: form.get("targetId"),
    reportType: form.get("reportType"), details: form.get("details"),
    evidenceUrl: form.get("evidenceUrl") || undefined,
    returnTo: form.get("returnTo") || "/", website: form.get("website") ?? "",
  });
  if (!parsed.success) return Response.json({ error: "invalid_report" }, { status: 400 });
  try {
    const account = await currentAccount();
    const evidenceUrl = safeEvidenceUrl(parsed.data.evidenceUrl);
    await createPublicReport({
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reportType: parsed.data.reportType,
      details: parsed.data.details,
      ...(evidenceUrl ? { evidenceUrl } : {}),
      accountOwnerKey: account ? accountKey(account) : null, fingerprint: submissionFingerprint(request),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "report_failed";
    return Response.json({ error: message }, { status: message === "report_rate_limited" ? 429 : 400 });
  }
  const destination = parsed.data.returnTo.startsWith("/") && !parsed.data.returnTo.startsWith("//")
    ? new URL(parsed.data.returnTo, request.url)
    : new URL("/", request.url);
  destination.searchParams.set("reported", "1");
  return NextResponse.redirect(destination, 303);
}
