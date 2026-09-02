import type { SourceHealth } from "@price-radar/schema";

export interface SourceHealthDecision {
  healthStatus: SourceHealth;
  consecutiveFailures: number;
  nextRunAt: Date;
}

export function nextHealthyRun(now: Date, intervalMs = 15 * 60_000): SourceHealthDecision {
  return {
    healthStatus: "healthy",
    consecutiveFailures: 0,
    nextRunAt: new Date(now.getTime() + intervalMs),
  };
}

export function nextFailedRun(
  now: Date,
  currentFailures: number,
): SourceHealthDecision {
  const consecutiveFailures = currentFailures + 1;
  const backoffMinutes = [5, 15, 60, 6 * 60, 24 * 60];
  const index = Math.min(consecutiveFailures - 1, backoffMinutes.length - 1);
  const minutes = backoffMinutes[index] ?? 24 * 60;
  return {
    healthStatus: consecutiveFailures >= 3 ? "failing" : "retrying",
    consecutiveFailures,
    nextRunAt: new Date(now.getTime() + minutes * 60_000),
  };
}
