import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { claimTypeValues } from "../claim/claim.types";
import { getRequestUser } from "../auth/requestUser";
import type { GameApiService } from "../services/GameApiService";

const roomIdParamSchema = z.object({ roomId: z.string().uuid() });

export function buildGameRoutes(gameApi: GameApiService) {
  return async function gameRoutes(app: FastifyInstance) {
    app.post("/rooms", async (request, reply) => {
      const bodySchema = z.object({
        maxPlayers: z.number().int().min(2).max(50).default(50),
        callInterval: z.number().int().min(1).max(30).default(5),
        prizes: z.array(z.enum(claimTypeValues)).optional()
      });

      const user = getRequestUser(request);
      const body = bodySchema.parse(request.body);
      const room = await gameApi.createRoom(user, body);

      return reply.code(201).send(room);
    });

    app.post("/rooms/join", async (request) => {
      const bodySchema = z.object({
        roomCode: z.string().length(6).regex(/^[A-Z0-9]+$/)
      });

      const user = getRequestUser(request);
      const { roomCode } = bodySchema.parse(request.body);

      return gameApi.joinRoom(user, roomCode);
    });

    app.post("/rooms/:roomId/start", async (request) => {
      const user = getRequestUser(request);
      const { roomId } = roomIdParamSchema.parse(request.params);
      return gameApi.startGame(user, roomId);
    });

    app.get("/rooms/:roomId/ticket", async (request) => {
      const user = getRequestUser(request);
      const { roomId } = roomIdParamSchema.parse(request.params);
      return gameApi.getTicket(user, roomId);
    });

    app.get("/rooms/:roomId/state", async (request) => {
      const { roomId } = roomIdParamSchema.parse(request.params);
      return gameApi.getState(roomId);
    });
  };
}
