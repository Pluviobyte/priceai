export interface WorkerConfig {
  redisUrl: string;
  concurrency: number;
}

export function readWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerConfig {
  return {
    redisUrl: env.REDIS_URL ?? "redis://localhost:6379",
    concurrency: Number(env.WORKER_CONCURRENCY ?? 4),
  };
}

