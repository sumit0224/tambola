import type { Socket } from "socket.io";
import type { UserRepository } from "@tambola/db";
import { TokenService } from "@tambola/security";

export type SocketSessionContext = {
  userId: string;
  sessionId: string;
  deviceId: string;
  displayName: string;
};

export function buildSocketAuth(input: { tokenService: TokenService; userRepository: UserRepository }) {
  return async function socketAuth(socket: Socket, next: (error?: Error) => void) {
    try {
      const authToken = socket.handshake.auth.token as string | undefined;
      const headerToken = typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, "")
        : undefined;

      const token = authToken ?? headerToken;
      if (!token) {
        next(new Error("UNAUTHORIZED"));
        return;
      }

      const claims = await input.tokenService.verifyAccessToken(token);

      const sessionId =
        (socket.handshake.auth.sessionId as string | undefined) ??
        (socket.handshake.headers["x-session-id"] as string | undefined) ??
        claims.sid;

      const deviceId =
        (socket.handshake.auth.deviceId as string | undefined) ??
        (socket.handshake.headers["x-device-id"] as string | undefined);

      if (!sessionId) {
        next(new Error("SESSION_ID_REQUIRED"));
        return;
      }

      const session = await input.userRepository.getActiveSession(sessionId);
      if (!session || session.userId !== claims.sub) {
        next(new Error("SESSION_INVALID"));
        return;
      }

      if (deviceId && session.deviceId !== deviceId) {
        next(new Error("DEVICE_MISMATCH"));
        return;
      }

      const user = await input.userRepository.findById(claims.sub);
      if (!user) {
        next(new Error("USER_NOT_FOUND"));
        return;
      }

      socket.data.session = {
        userId: user.id,
        sessionId,
        deviceId: deviceId ?? session.deviceId,
        displayName: user.displayName
      } satisfies SocketSessionContext;

      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  };
}
