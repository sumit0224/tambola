import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { RoomManager } from "../managers/RoomManager";

export async function roomRoutes(app: FastifyInstance) {
  const roomManager = new RoomManager();

  app.post("/rooms", async (request, reply) => {
    const bodySchema = z.object({
      hostId: z.string().uuid(),
      maxPlayers: z.number().int().min(2).max(50).default(50),
      callInterval: z.number().int().min(1).max(30).default(5)
    });

    const body = bodySchema.parse(request.body);
    const room = roomManager.createRoom(body.hostId, {
      maxPlayers: body.maxPlayers,
      callInterval: body.callInterval
    });

    return reply.code(201).send(room);
  });

  app.post("/rooms/join", async (request, reply) => {
    const bodySchema = z.object({ roomCode: z.string().length(6) });
    const { roomCode } = bodySchema.parse(request.body);
    const room = roomManager.getByRoomCode(roomCode);

    if (!room) {
      return reply.code(404).send({ error: "ROOM_NOT_FOUND" });
    }

    return {
      roomId: room.id,
      status: room.status,
      playerCount: 1,
      hostId: room.hostId
    };
  });
}
