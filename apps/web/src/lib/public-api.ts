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

export function parsePagination(request: Request, maximum = 100): { limit: number; offset: number; page: number } {
  const params = new URL(request.url).searchParams;
  const limit = Math.min(maximum, Math.max(1, Number.parseInt(params.get("limit") ?? "50", 10) || 50));
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  return { limit, page, offset: (page - 1) * limit };
}

export function paginated<T>(items: T[], pagination: { limit: number; offset: number; page: number }) {
  return { data: items.slice(pagination.offset, pagination.offset + pagination.limit), pagination: { page: pagination.page, limit: pagination.limit, total: items.length, hasNext: pagination.offset + pagination.limit < items.length } };
}
