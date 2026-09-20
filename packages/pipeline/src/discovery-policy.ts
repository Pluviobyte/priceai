/** Shared retry policy. Persist absolute deadlines so restarts cannot erase them. */
export const DISCOVERY_DAY_MS = 86_400_000;
export const MARKETPLACE_DISABLED = "16688_marketplace_rejected:未开启货源商品列表";
export const DISCOVERY_OWNERSHIP = "provider_advisory_v1";

export class DiscoveryHttpError extends Error {
  readonly retryAfterAt: string | undefined;
  constructor(message: string, readonly status: number, retryAfter: string | null, now = Date.now()) {
    super(message);
    const value = retryAfter?.trim();
    const timestamp = value && /^\d+$/.test(value) ? now + Number(value) * 1000 : value ? Date.parse(value) : NaN;
    this.retryAfterAt = Number.isFinite(timestamp) && timestamp > now && timestamp <= 8.64e15 ? new Date(timestamp).toISOString() : undefined;
  }
}

export function discoveryFailure(error: unknown, failedAt: Date, failures: number) {
  const message = error instanceof Error ? error.message : String(error);
  const kind = message === MARKETPLACE_DISABLED ? "marketplace_disabled"
    : error instanceof DiscoveryHttpError && error.status === 429 || /_http_429(?:\b|:)/.test(message) ? "rate_limited"
    : /_http_(401|403)(?:\b|:)/.test(message) ? "access_denied" : "transient";
  const delay = kind === "transient" ? Math.min(DISCOVERY_DAY_MS, 900_000 * 2 ** Math.min(7, Math.max(0, failures - 1))) : DISCOVERY_DAY_MS;
  const retryAfterAt = error instanceof DiscoveryHttpError ? error.retryAfterAt : undefined;
  return { failureClass: kind, consecutiveFailures: failures,
    retryAt: new Date(Math.max(failedAt.getTime() + delay, retryAfterAt ? Date.parse(retryAfterAt) : 0)).toISOString(),
    ...(retryAfterAt ? { retryAfterAt } : {}) };
}

export interface DiscoveryAttempt {
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  errorMessage: string | null;
  evidence: Record<string, unknown>;
}

export function discoveryFailureCount(attempts: DiscoveryAttempt[]): number {
  const completed = attempts.filter(row => row.status === "success" || row.status === "failed");
  if (completed[0]?.status !== "failed") return 0;
  const stored = Number(completed[0].evidence.consecutiveFailures);
  if (Number.isInteger(stored) && stored > 0) return stored;
  const boundary = completed.findIndex(row => row.status !== "failed");
  return boundary < 0 ? completed.length : boundary;
}

/** Input ordered newest first. Legacy failed rows receive the same conservative policy. */
export function discoveryDecision(attempts: DiscoveryAttempt[], minIntervalMs: number | undefined, now: Date) {
  const last = attempts.find(row => row.status === "success" || row.status === "failed");
  if (!last) return null;
  const ended = last.finishedAt ?? last.startedAt;
  if (last.status === "success") {
    const retryAt = new Date(ended.getTime() + (minIntervalMs ?? 0));
    return now < retryAt ? { status: "skipped" as const, reason: "success_interval", retryAt: retryAt.toISOString() } : null;
  }
  const failures = discoveryFailureCount(attempts);
  const fallback = discoveryFailure(new Error(last.errorMessage ?? "discovery_failed"), ended, Math.max(1, failures));
  const stored = typeof last.evidence.retryAt === "string" ? Date.parse(last.evidence.retryAt) : NaN;
  const retryAt = Number.isFinite(stored) ? stored : Date.parse(fallback.retryAt);
  return now.getTime() < retryAt ? { status: "deferred" as const, reason: String(last.evidence.failureClass ?? fallback.failureClass), retryAt: new Date(retryAt).toISOString() } : null;
}
