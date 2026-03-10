import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserRepository } from "@tambola/db";
import { PasswordService, TokenService } from "@tambola/security";
import { RateLimitService } from "@tambola/redis";
import { AppError } from "../utils/AppError";
import { LegacyProxyService } from "../services/LegacyProxyService";

const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(2).max(60),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(16)
});

export function buildAuthRoutes(input: {
  userRepository: UserRepository;
  tokenService: TokenService;
  passwordService: PasswordService;
  rateLimitService: RateLimitService;
  useNewAuth: boolean;
  legacyProxy: LegacyProxyService;
}) {
  return async function authRoutes(app: FastifyInstance) {
    app.post("/auth/register", async (request, reply) => {
      if (!input.useNewAuth) {
        return input.legacyProxy.forward({
          path: "/v1/auth/register",
          method: "POST",
          body: request.body
        });
      }

      const rateLimitResult = await input.rateLimitService.consume(request.ip, {
        bucket: "register",
        points: 10,
        windowSeconds: 60
      });

      if (!rateLimitResult.allowed) {
        throw new AppError(429, "RATE_LIMITED");
      }

      const body = registerSchema.parse(request.body);
      const existing = await input.userRepository.findByEmail(body.email.toLowerCase());
      if (existing) {
        throw new AppError(409, "EMAIL_EXISTS");
      }

      const passwordHash = await input.passwordService.hash(body.password);
      const user = await input.userRepository.createUser({
        email: body.email.toLowerCase(),
        displayName: body.displayName,
        passwordHash
      });

      const deviceId = (request.headers["x-device-id"] as string | undefined) ?? "unknown-device";
      const sessionId = crypto.randomUUID();
      const tokenPair = await input.tokenService.issuePair({
        userId: user.id,
        sessionId,
        deviceId
      });

      await input.userRepository.createSession({
        sessionId,
        userId: user.id,
        refreshToken: tokenPair.refreshToken,
        accessJti: tokenPair.accessJti,
        deviceId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      await input.userRepository.recordDeviceFingerprint({
        userId: user.id,
        fingerprintHash: deviceId,
        platform: request.headers["x-platform"] as string | undefined,
        appVersion: request.headers["x-app-version"] as string | undefined,
        ipAddress: request.ip
      });

      return reply.code(201).send({
        userId: user.id,
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken
      });
    });

    app.post("/auth/login", async (request) => {
      if (!input.useNewAuth) {
        return input.legacyProxy.forward({
          path: "/v1/auth/login",
          method: "POST",
          body: request.body
        });
      }

      const rateLimitResult = await input.rateLimitService.consume(request.ip, {
        bucket: "login",
        points: 20,
        windowSeconds: 60
      });

      if (!rateLimitResult.allowed) {
        throw new AppError(429, "RATE_LIMITED");
      }

      const body = loginSchema.parse(request.body);
      const user = await input.userRepository.findByEmail(body.email.toLowerCase());
      if (!user?.passwordHash) {
        throw new AppError(401, "INVALID_CREDENTIALS");
      }

      const isValidPassword = await input.passwordService.verify(body.password, user.passwordHash);
      if (!isValidPassword) {
        throw new AppError(401, "INVALID_CREDENTIALS");
      }

      const deviceId = (request.headers["x-device-id"] as string | undefined) ?? "unknown-device";
      const sessionId = crypto.randomUUID();
      const tokenPair = await input.tokenService.issuePair({
        userId: user.id,
        sessionId,
        deviceId
      });

      await input.userRepository.createSession({
        sessionId,
        userId: user.id,
        refreshToken: tokenPair.refreshToken,
        accessJti: tokenPair.accessJti,
        deviceId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      await input.userRepository.touchLastSeen(user.id);
      await input.userRepository.recordDeviceFingerprint({
        userId: user.id,
        fingerprintHash: deviceId,
        platform: request.headers["x-platform"] as string | undefined,
        appVersion: request.headers["x-app-version"] as string | undefined,
        ipAddress: request.ip
      });

      return {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName
        }
      };
    });

    app.post("/auth/refresh", async (request) => {
      if (!input.useNewAuth) {
        return input.legacyProxy.forward({
          path: "/v1/auth/refresh",
          method: "POST",
          body: request.body
        });
      }

      const body = refreshSchema.parse(request.body);
      const refreshClaims = await input.tokenService.verifyRefreshToken(body.refreshToken).catch(() => {
        throw new AppError(401, "INVALID_REFRESH_TOKEN");
      });

      const activeSession = await input.userRepository.getActiveSessionByRefreshToken(body.refreshToken);
      if (!activeSession || activeSession.id !== refreshClaims.sid) {
        throw new AppError(401, "SESSION_INVALID");
      }

      const newSessionId = crypto.randomUUID();
      const tokenPair = await input.tokenService.issuePair({
        userId: refreshClaims.sub,
        sessionId: newSessionId,
        deviceId: activeSession.deviceId
      });

      await input.userRepository.rotateSession({
        oldSessionId: activeSession.id,
        newSessionId,
        userId: refreshClaims.sub,
        refreshToken: tokenPair.refreshToken,
        accessJti: tokenPair.accessJti,
        deviceId: activeSession.deviceId,
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      });

      return {
        token: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken
      };
    });

    app.post("/auth/logout", async (request) => {
      if (!input.useNewAuth) {
        return input.legacyProxy.forward({
          path: "/v1/auth/logout",
          method: "POST",
          body: request.body,
          headers: {
            authorization: request.headers.authorization
          }
        });
      }

      const authHeader = request.headers.authorization;
      if (!authHeader) {
        throw new AppError(401, "UNAUTHORIZED");
      }

      const accessToken = authHeader.replace("Bearer ", "");
      const claims = await input.tokenService.verifyAccessToken(accessToken).catch(() => {
        throw new AppError(401, "INVALID_TOKEN");
      });

      await input.userRepository.revokeSession(claims.sid);
      return { success: true };
    });
  };
}
