import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { GameLoopWorker } from "../services/GameLoopWorker";

const roomIdSchema = z.object({
  roomId: z.string().uuid()
});

export function buildControlRoutes(worker: GameLoopWorker) {
  return async function controlRoutes(app: FastifyInstance) {
    app.post("/games/:roomId/pause", async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);
      await worker.pauseGame(roomId);
      return { roomId, paused: true };
    });

    app.post("/games/:roomId/resume", async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);
      await worker.resumeGame(roomId);
      return { roomId, paused: false };
    });

    app.post("/games/:roomId/stop", async (request) => {
      const { roomId } = roomIdSchema.parse(request.params);
      await worker.stopGame(roomId);
      return { roomId, stopped: true };
    });
  };
}
