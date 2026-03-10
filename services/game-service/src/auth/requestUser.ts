import type { FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { AppError } from "../common/errors";

export type RequestUser = {
  userId: string;
  displayName: string;
};

function asSingleHeader(value: string | string[] | undefined): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? value[0] : value;
}

function extractToken(authorization: string | null): string | null {
  if (!authorization) {
    return null;
  }

  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : authorization.trim();
  if (!token) {
    return null;
  }

  return token;
}

export function getRequestUser(request: FastifyRequest): RequestUser {
  const authorization = asSingleHeader(request.headers.authorization as string | string[] | undefined);

  const token = extractToken(authorization);
  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", {
      message: "Provide Authorization: Bearer <token>"
    });
  }

  const secret = process.env.JWT_ACCESS_SECRET ?? process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(500, "JWT_SECRET_MISSING");
  }

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, secret) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, "INVALID_TOKEN");
  }

  if (payload.type && payload.type !== "access") {
    throw new AppError(401, "INVALID_TOKEN");
  }

  const userId = payload.sub ? String(payload.sub) : null;
  if (!userId) {
    throw new AppError(401, "INVALID_TOKEN");
  }

  const displayName =
    asSingleHeader(request.headers["x-display-name"] as string | string[] | undefined) ??
    `Player-${userId.slice(0, 6)}`;

  return {
    userId,
    displayName
  };
}
