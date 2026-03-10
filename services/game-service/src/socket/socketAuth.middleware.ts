import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";

function extractUserId(rawToken: unknown): string | null {
  if (typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return null;
  }

  const token = rawToken.startsWith("Bearer ") ? rawToken.slice(7).trim() : rawToken.trim();
  return token || null;
}

export function socketAuth(socket: Socket, next: (err?: Error) => void) {
  const token = extractUserId(socket.handshake.auth?.token);
  if (!token) {
    next(new Error("UNAUTHORIZED"));
    return;
  }

  const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    next(new Error("JWT_SECRET_MISSING"));
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    if (payload.type && payload.type !== "access") {
      next(new Error("UNAUTHORIZED"));
      return;
    }
    const userId = payload.sub ? String(payload.sub) : null;
    if (!userId) {
      next(new Error("UNAUTHORIZED"));
      return;
    }

    socket.data.userId = userId;
  } catch {
    next(new Error("UNAUTHORIZED"));
    return;
  }

  socket.data.displayName =
    typeof socket.handshake.auth?.displayName === "string"
      ? socket.handshake.auth.displayName
      : `Player-${socket.data.userId.slice(0, 6)}`;

  next();
}
