import type { FastifyReply, FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { redis } from "../client";
import { redisKeys } from "../keys";

export type RateLimitPolicy = {
  bucket: string;
  points: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
};

export class RateLimitService {
  constructor(private readonly redisClient: Redis = redis) {}

  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitResult> {
    const redisKey = redisKeys.rateLimit(policy.bucket, key);

    const consumed = await this.redisClient.incr(redisKey);
    if (consumed === 1) {
      await this.redisClient.expire(redisKey, policy.windowSeconds);
    }

    const ttl = await this.redisClient.ttl(redisKey);
    const remaining = Math.max(0, policy.points - consumed);

    return {
      allowed: consumed <= policy.points,
      remaining,
      resetInSeconds: ttl > 0 ? ttl : policy.windowSeconds
    };
  }

  async fastifyGuard(request: FastifyRequest, reply: FastifyReply, policy: RateLimitPolicy): Promise<boolean> {
    const ip = request.ip;
    const userId = (request as any).user?.userId as string | undefined;
    const key = userId ? `${ip}:${userId}` : ip;

    const result = await this.consume(key, policy);
    reply.header("X-RateLimit-Remaining", String(result.remaining));
    reply.header("X-RateLimit-Reset", String(result.resetInSeconds));

    if (result.allowed) {
      return true;
    }

    reply.code(429).send({
      error: "RATE_LIMITED",
      reason: `Exceeded limit for ${policy.bucket}`
    });

    return false;
  }

  async socketGuard(input: {
    socketId: string;
    userId?: string;
    ip?: string;
    policy: RateLimitPolicy;
  }): Promise<RateLimitResult> {
    const key = [input.ip, input.userId, input.socketId].filter(Boolean).join(":");
    return this.consume(key, input.policy);
  }
}
