import "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    authGuard: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    auth?: {
      userId: string;
      sessionId: string;
      deviceId?: string;
      accessJti?: string;
    };
  }
}
