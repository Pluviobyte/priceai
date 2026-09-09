import { setTimeout as delay } from 'node:timers/promises';
/** Run independent platforms concurrently, keeping all jobs for one platform FIFO. */
export class PlatformTaskPool {
  private active = new Set<string>();
  private queue: Array<{key: string; work: () => Promise<void>; resolve: () => void; reject: (error: unknown) => void}> = [];
  constructor(private readonly concurrency: number, private readonly signal: AbortSignal) {
    if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('invalid_platform_concurrency');
  }
  run(key: string, work: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({key, work, resolve, reject});
      this.drain();
    });
  }
  private drain() {
    if (this.signal.aborted) {
      for (const job of this.queue.splice(0)) job.reject(this.signal.reason);
      return;
    }
    while (this.active.size < this.concurrency) {
      const index = this.queue.findIndex(job => !this.active.has(job.key));
      if (index < 0) return;
      const job = this.queue.splice(index, 1)[0]!;
      this.active.add(job.key);
      void Promise.resolve().then(() => { this.signal.throwIfAborted(); return job.work(); }).then(job.resolve, job.reject).finally(() => {
        this.active.delete(job.key);
        this.drain();
      });
    }
  }
}

/** Coalesce completed shops into serialized publications, including during long crawls.
 * Changes arriving during publication belong to the next generation. Failed writes
 * stay dirty and retry; flush must finish before the cycle releases its DB lock.
 */
export class IncrementalPublisher {
  private dirty = 0;
  private running: Promise<void> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closing = false;
  constructor(private readonly publish: () => Promise<void>, private readonly onError: (error: unknown) => void,
    private readonly batch = 3, private readonly delayMs = 30_000) {}
  changed() {
    this.dirty++;
    this.schedule();
  }
  private schedule() {
    if (this.closing || this.running || !this.dirty) return;
    if (this.dirty >= this.batch) { this.start(); return; }
    this.timer ??= setTimeout(() => { this.timer = undefined; this.start(); }, this.delayMs);
  }
  private start() {
    if (this.running || !this.dirty) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    const count = this.dirty;
    this.dirty = 0;
    this.running = Promise.resolve().then(this.publish).catch(error => {
      this.dirty += count;
      this.onError(error);
      // Retry after a delay, even when the pending count exceeds the batch size.
      if (!this.closing) this.timer = setTimeout(() => { this.timer = undefined; this.start(); }, this.delayMs);
    }).finally(() => {
      this.running = undefined;
      if (!this.timer) this.schedule();
    });
  }
  async flush() {
    this.closing = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    await this.running;
    if (this.dirty) {
      const count = this.dirty;
      this.dirty = 0;
      try { await this.publish(); }
      catch (error) { this.dirty += count; throw error; }
    }
  }
}

/** Continuously refill free slots; a slow platform never creates a batch barrier. */
export async function dispatchContinuously<T extends {platform:string}>(options: {
  concurrency:number;signal:AbortSignal;pull:(busy:readonly string[])=>Promise<T|undefined>;
  work:(job:T)=>Promise<void>;onError:(error:unknown)=>void;
}) {
  const active=new Map<string,Promise<void>>();
  try {
    while(!options.signal.aborted) {
      if(active.size<options.concurrency) {
        const job=await options.pull([...active.keys()]);
        if(job) {
          if(active.has(job.platform)) throw new Error('dispatcher_duplicate_platform');
          const work=Promise.resolve().then(()=>{options.signal.throwIfAborted();return options.work(job);})
            .catch(options.onError).finally(()=>{active.delete(job.platform);});
          active.set(job.platform,work);
          continue;
        }
      }
      // Abort-aware bounded wait; no per-task timer/listener accumulation.
      await delay(250,undefined,{signal:options.signal}).catch(()=>undefined);
    }
  } finally { await Promise.allSettled(active.values()); }
}
