/** A request gate can coordinate budgets and circuit state outside the process. */
export interface RequestPolicy {
  run<T>(hostname: string, work: () => Promise<T>, signal: AbortSignal): Promise<T>;
}
export class PlatformDeferredError extends Error {
  constructor(readonly retryAt: Date, readonly reason: string) {
    super(`platform_deferred:${retryAt.toISOString()}:${reason}`);
    this.name = 'PlatformDeferredError';
  }
}
/** Probe/trial boundaries serialize errors into strings. */
export function platformRetryAt(message: string | null | undefined): Date | undefined {
  const match = message?.match(/platform_deferred:(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z):/);
  return match ? new Date(match[1]!) : undefined;
}
