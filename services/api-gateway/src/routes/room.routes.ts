import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getServiceMetrics } from "@tambola/observability";
import { extractBearerToken } from "@tambola/security";
import { RateLimitService } from "@tambola/redis";
import { AppError } from "../utils/AppError";
import { LegacyProxyService } from "../services/LegacyProxyService";
import { RoomBackboneService } from "../services/RoomBackboneService";

const createRoomSchema = z.object({
  maxPlayers: z.number().int().min(2).max(100).default(50),
  callInterval: z.number().int().min(1).max(30).default(5),
  prizes: z.array(z.string()).optional()
});

const joinRoomSchema = z.object({
  roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/)
});

const roomIdSchema = z.object({
  roomId: z.string().uuid()
});

const claimSchema = z.object({
  claimType: z.enum(["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "EARLY_FIVE", "FULL_HOUSE"])
});

export function buildRoomRoutes(input: {
  roomBackboneService: RoomBackboneService;
  rateLimitService: RateLimitService;
  legacyProxy: LegacyProxyService;
  useDurableBackbone: boolean;
  enableFraudEnforcement: boolean;
}) {
  const metrics = getServiceMetrics("api_gateway");

  return async function roomRoutes(app: FastifyInstance) {
    app.post("/rooms", { preHandler: [app.authGuard] }, async (request, reply) => {
      const body = createRoomSchema.parse(request.body);

      if (!input.useDurableBackbone) {
        const token = extractBearerToken(request.headers.authorization);
        return input.legacyProxy.forward({
          path: "/v1/rooms",
          method: "POST",
          token: token ?? undefined,
          body
        });
      }

      const result = await input.roomBackboneService.createRoom({
        userId: request.auth!.userId,
        maxPlayers: body.maxPlayers,
        callInterval: body.callInterval,
        prizes: body.prizes
      });

      return reply.code(201).send(result);
    });

    app.post("/rooms/join", { preHandler: [app.authGuard] }, async (request) => {
      const body = joinRoomSchema.parse(request.body);

      const rateLimitResult = await input.rateLimitService.consume(`${request.ip}:${request.auth!.userId}`, {
        bucket: "join-room",
        points: 30,
        windowSeconds: 60
      });

      if (!rateLimitResult.allowed) {
        throw new AppError(429, "RATE_LIMITED");
      }

      if (!input.useDurableBackbone) {
        const token = extractBearerToken(request.headers.authorization);
        return input.legacyProxy.forward({
          path: "/v1/rooms/join",
          method: "POST",
          token: token ?? undefined,
          body
        });
      }

      return input.roomBackboneService.joinRoom({
        userId: request.auth!.userId,
        roomCode: body.roomCode
      });
    });

    app.post("/rooms/:roomId/start", { preHandler: [app.authGuard] }, async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);

      if (!input.useDurableBackbone) {
        const token = extractBearerToken(request.headers.authorization);
        return input.legacyProxy.forward({
          path: `/v1/rooms/${roomId}/start`,
          method: "POST",
          token: token ?? undefined,
          body: {}
        });
      }

      return input.roomBackboneService.startGame({
        roomId,
        hostUserId: request.auth!.userId
      });
    });

    app.post("/rooms/:roomId/claim", { preHandler: [app.authGuard] }, async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);
      const body = claimSchema.parse(request.body);

      const rateLimitResult = await input.rateLimitService.consume(`${request.ip}:${request.auth!.userId}`, {
        bucket: "claim",
        points: 10,
        windowSeconds: 60
      });

      if (!rateLimitResult.allowed) {
        throw new AppError(429, "RATE_LIMITED");
      }

      const token = extractBearerToken(request.headers.authorization);
      const claimStartedAt = Date.now();

      const result = await input.legacyProxy.forward<{ status: string }>({
        path: `/v1/rooms/${roomId}/claim`,
        method: "POST",
        token: token ?? undefined,
        body
      });
      metrics.claimLatencyMs.observe(Date.now() - claimStartedAt);

      if (input.enableFraudEnforcement) {
        const claimLatencyMs = Date.now() - claimStartedAt;
        await input.roomBackboneService.evaluateFraud({
          roomId,
          userId: request.auth!.userId,
          claimLatencyMs,
          invalidClaimRatio: result.status === "VALID" ? 0 : 1,
          multiDeviceAnomaly: 0,
          ipChurn: 0
        });
      }

      return result;
    });

    app.get("/rooms/:roomId/state", { preHandler: [app.authGuard] }, async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);

      if (!input.useDurableBackbone) {
        const token = extractBearerToken(request.headers.authorization);
        return input.legacyProxy.forward({
          path: `/v1/rooms/${roomId}/state`,
          method: "GET",
          token: token ?? undefined
        });
      }

      return input.roomBackboneService.getRoomState(roomId);
    });

    app.get("/rooms/:roomId/recovery", { preHandler: [app.authGuard] }, async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);
      const querySchema = z.object({
        lastOffset: z.coerce.number().int().nonnegative().optional()
      });

      const query = querySchema.parse(request.query ?? {});
      return input.roomBackboneService.getRecovery(roomId, query.lastOffset ?? null);
    });
  };
}
