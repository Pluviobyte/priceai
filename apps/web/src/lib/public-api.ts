import { NextResponse } from "next/server";
import { consumePublicApiQuota } from "./public-platform";
import { submissionFingerprint } from "./public-submissions";

export async function publicApiGuard(request: Request): Promise<NextResponse | null> {
  const quota = await consumePublicApiQuota(submissionFingerprint(request));
  if (quota.allowed) return null;
  return NextResponse.json(
    { error: "rate_limit_exceeded", resetAt: quota.resetAt.toISOString() },
    { status: 429, headers: { "Retry-After": String(Math.ceil((quota.resetAt.getTime() - Date.now()) / 1000)) } },
  );
}

export function publicApiResponse(body: unknown): NextResponse {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
