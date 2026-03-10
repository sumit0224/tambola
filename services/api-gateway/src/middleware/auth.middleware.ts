import type { FastifyReply, FastifyRequest } from "fastify";
import { extractBearerToken, TokenService } from "@tambola/security";
import { UserRepository } from "@tambola/db";
import { AppError } from "../utils/AppError";

export function buildAuthMiddleware(input: { tokenService: TokenService; userRepository: UserRepository }) {
  return async function authMiddleware(request: FastifyRequest, _reply: FastifyReply) {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new AppError(401, "UNAUTHORIZED");
    }

    const claims = await input.tokenService.verifyAccessToken(token).catch(() => {
      throw new AppError(401, "INVALID_TOKEN");
    });

    const session = await input.userRepository.getActiveSession(claims.sid);
    if (!session || session.userId !== claims.sub) {
      throw new AppError(401, "SESSION_INVALID");
    }

    const headerDeviceId = request.headers["x-device-id"];
    const deviceId = typeof headerDeviceId === "string" ? headerDeviceId : undefined;

    if (deviceId && session.deviceId !== deviceId) {
      throw new AppError(401, "DEVICE_MISMATCH");
    }

    request.auth = {
      userId: claims.sub,
      sessionId: claims.sid,
      deviceId,
      accessJti: claims.jti
    };
  };
}
