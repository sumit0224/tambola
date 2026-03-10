import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const redisOptions = {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => Math.min(times * 50, 2000),
  reconnectOnError: (error: Error) => error.message.includes("READONLY")
};

export const redis = new Redis(redisUrl, redisOptions);
export const redisSubscriber = new Redis(redisUrl, redisOptions);
export const redisPublisher = new Redis(redisUrl, redisOptions);

export async function disconnectRedis(): Promise<void> {
  await Promise.all([
    redis.quit().catch(() => undefined),
    redisSubscriber.quit().catch(() => undefined),
    redisPublisher.quit().catch(() => undefined)
  ]);
}
