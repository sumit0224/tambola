import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { claimTypeValues } from "../claim/claim.types";
import { getRequestUser } from "../auth/requestUser";
import type { GameApiService } from "../services/GameApiService";

export function buildClaimRoutes(gameApi: GameApiService) {
  return async function claimRoutes(app: FastifyInstance) {
    app.post("/rooms/:roomId/claim", async (request) => {
      const paramsSchema = z.object({ roomId: z.string().uuid() });
      const bodySchema = z.object({
        claimType: z.enum(claimTypeValues)
      });

      const user = getRequestUser(request);
      const { roomId } = paramsSchema.parse(request.params);
      const { claimType } = bodySchema.parse(request.body);

      return gameApi.submitClaim(user, roomId, claimType);
    });
  };
}
