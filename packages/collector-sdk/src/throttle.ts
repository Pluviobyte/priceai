/**
 * Per-host request pacing shared by every HTTP collector.
 *
 * Multi-tenant storefront platforms (LDXP, 16688) host hundreds of shops behind
 * one origin, so hundreds of sources hit the same host. The crawl lease only
 * bounds concurrency per host; this throttle bounds the request rate with a
 * minimum spacing plus jitter and honours a cooldown after 429/5xx responses.
 */
export interface HostThrottleOptions {
  minIntervalMs?: number;
  maxConcurrency?: number;
  jitterMs?: number;
}

interface HostState {
  nextAllowedAt: number;
  active: number;
  waiters: Array<() => void>;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error("throttle_aborted"));
    }
    if (signal?.aborted) return onAbort();
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export class HostThrottle {
  readonly #minIntervalMs: number;
  readonly #maxConcurrency: number;
  readonly #jitterMs: number;
  readonly #hosts = new Map<string, HostState>();

  constructor(options: HostThrottleOptions = {}) {
    this.#minIntervalMs = Math.max(0, options.minIntervalMs ?? 700);
    this.#maxConcurrency = Math.max(1, options.maxConcurrency ?? 2);
    this.#jitterMs = Math.max(0, options.jitterMs ?? 300);
  }

  #state(hostname: string): HostState {
    const key = hostname.toLowerCase();
    let state = this.#hosts.get(key);
    if (!state) {
      state = { nextAllowedAt: 0, active: 0, waiters: [] };
      this.#hosts.set(key, state);
    }
    return state;
  }

  /** Waits until a request to `hostname` may start, then returns a release callback. */
  async acquire(hostname: string, signal?: AbortSignal): Promise<() => void> {
    const state = this.#state(hostname);
    while (state.active >= this.#maxConcurrency) {
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          state.waiters = state.waiters.filter((waiter) => waiter !== wake);
          reject(signal?.reason instanceof Error ? signal.reason : new Error("throttle_aborted"));
        };
        const wake = () => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        if (signal?.aborted) return onAbort();
        signal?.addEventListener("abort", onAbort, { once: true });
        state.waiters.push(wake);
      });
    }
    state.active += 1;
    const now = Date.now();
    const wait = Math.max(0, state.nextAllowedAt - now);
    state.nextAllowedAt = Math.max(now, state.nextAllowedAt) + this.#minIntervalMs + Math.round(Math.random() * this.#jitterMs);
    try {
      await sleep(wait, signal);
    } catch (error) {
      this.#release(state);
      throw error;
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.#release(state);
    };
  }

  /** Runs `work` for one request against `hostname` under the host budget. */
  async run<T>(hostname: string, work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(hostname, signal);
    try {
      return await work();
    } finally {
      release();
    }
  }

  /** Pushes the next allowed request for `hostname` out, e.g. after 429 or Retry-After. */
  cooldown(hostname: string, ms: number): void {
    const state = this.#state(hostname);
    state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now() + Math.max(0, ms));
  }

  #release(state: HostState): void {
    state.active = Math.max(0, state.active - 1);
    const next = state.waiters.shift();
    if (next) next();
  }
}

function envNumber(name: string, fallback: number): number {
  const raw = typeof process !== "undefined" ? process.env[name] : undefined;
  const parsed = raw === undefined || raw === "" ? Number.NaN : Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Process-wide throttle used by collectors unless a caller injects its own. */
export const hostThrottle = new HostThrottle({
  minIntervalMs: envNumber("COLLECTOR_HOST_MIN_INTERVAL_MS", 700),
  maxConcurrency: envNumber("COLLECTOR_HOST_MAX_CONCURRENCY", 2),
  jitterMs: envNumber("COLLECTOR_HOST_JITTER_MS", 300),
});
