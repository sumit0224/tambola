import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getRuntimeConfig } from "@tambola/config";
import { UserRepository } from "@tambola/db";
import { AppError } from "../common/errors";

export type RegisterInput = {
  email: string;
  displayName: string;
  password: string;
};

export class AuthService {
  private readonly runtimeConfig = getRuntimeConfig(process.env);

  constructor(private readonly userRepository = new UserRepository()) {}

  async register(
    input: RegisterInput,
    meta: { deviceId: string; ipAddress?: string; userAgent?: string }
  ) {
    const existing = await this.userRepository.findByEmail(input.email.toLowerCase());
    if (existing) {
      throw new AppError(409, "EMAIL_EXISTS");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await this.userRepository.createUser({
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      passwordHash
    });

    const sessionId = crypto.randomUUID();
    const tokenPair = this.issueTokenPair({
      userId: user.id,
      sessionId,
      deviceId: meta.deviceId
    });

    await this.userRepository.createSession({
      sessionId,
      userId: user.id,
      refreshToken: tokenPair.refreshToken,
      accessJti: tokenPair.accessJti,
      deviceId: meta.deviceId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      expiresAt: new Date(Date.now() + this.runtimeConfig.env.REFRESH_TOKEN_TTL_SECONDS * 1000)
    });

    await this.userRepository.recordDeviceFingerprint({
      userId: user.id,
      fingerprintHash: meta.deviceId,
      ipAddress: meta.ipAddress
    });

    return {
      userId: user.id,
      token: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken
    };
  }

  async login(input: { email: string; password: string }, meta: { deviceId: string; ipAddress?: string }) {
    const user = await this.userRepository.findByEmail(input.email.toLowerCase());
    if (!user?.passwordHash) {
      throw new AppError(401, "INVALID_CREDENTIALS");
    }

    const isValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isValid) {
      throw new AppError(401, "INVALID_CREDENTIALS");
    }

    const sessionId = crypto.randomUUID();
    const tokenPair = this.issueTokenPair({
      userId: user.id,
      sessionId,
      deviceId: meta.deviceId
    });

    await this.userRepository.createSession({
      sessionId,
      userId: user.id,
      refreshToken: tokenPair.refreshToken,
      accessJti: tokenPair.accessJti,
      deviceId: meta.deviceId,
      ipAddress: meta.ipAddress,
      expiresAt: new Date(Date.now() + this.runtimeConfig.env.REFRESH_TOKEN_TTL_SECONDS * 1000)
    });

    await this.userRepository.touchLastSeen(user.id);

    return {
      token: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName
      }
    };
  }

  async refresh(input: { refreshToken: string }) {
    const refreshClaims = this.verifyRefreshToken(input.refreshToken);
    const activeSession = await this.userRepository.getActiveSessionByRefreshToken(input.refreshToken);
    if (!activeSession || activeSession.id !== refreshClaims.sid) {
      throw new AppError(401, "SESSION_INVALID");
    }

    const newSessionId = crypto.randomUUID();
    const tokenPair = this.issueTokenPair({
      userId: refreshClaims.sub,
      sessionId: newSessionId,
      deviceId: activeSession.deviceId
    });

    await this.userRepository.rotateSession({
      oldSessionId: activeSession.id,
      newSessionId,
      userId: refreshClaims.sub,
      refreshToken: tokenPair.refreshToken,
      accessJti: tokenPair.accessJti,
      deviceId: activeSession.deviceId,
      ipAddress: activeSession.ipAddress ?? undefined,
      userAgent: activeSession.userAgent ?? undefined,
      expiresAt: new Date(Date.now() + this.runtimeConfig.env.REFRESH_TOKEN_TTL_SECONDS * 1000)
    });

    return {
      token: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken
    };
  }

  verifyAccessToken(token: string): { sub: string; sid: string; deviceId?: string } {
    const payload = jwt.verify(token, this.runtimeConfig.env.JWT_ACCESS_SECRET, {
      issuer: this.runtimeConfig.env.JWT_ISSUER,
      audience: this.runtimeConfig.env.JWT_AUDIENCE
    }) as jwt.JwtPayload;

    if (payload.type !== "access" || !payload.sub || !payload.sid) {
      throw new AppError(401, "INVALID_TOKEN");
    }

    return {
      sub: String(payload.sub),
      sid: String(payload.sid),
      deviceId: payload.deviceId ? String(payload.deviceId) : undefined
    };
  }

  private verifyRefreshToken(token: string): { sub: string; sid: string } {
    const payload = jwt.verify(token, this.runtimeConfig.env.JWT_REFRESH_SECRET, {
      issuer: this.runtimeConfig.env.JWT_ISSUER,
      audience: this.runtimeConfig.env.JWT_AUDIENCE
    }) as jwt.JwtPayload;

    if (payload.type !== "refresh" || !payload.sub || !payload.sid) {
      throw new AppError(401, "INVALID_REFRESH_TOKEN");
    }

    return {
      sub: String(payload.sub),
      sid: String(payload.sid)
    };
  }

  private issueTokenPair(input: { userId: string; sessionId: string; deviceId: string }) {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessToken = jwt.sign(
      {
        type: "access",
        sid: input.sessionId,
        deviceId: input.deviceId
      },
      this.runtimeConfig.env.JWT_ACCESS_SECRET,
      {
        algorithm: "HS256",
        issuer: this.runtimeConfig.env.JWT_ISSUER,
        audience: this.runtimeConfig.env.JWT_AUDIENCE,
        subject: input.userId,
        jwtid: accessJti,
        expiresIn: this.runtimeConfig.env.ACCESS_TOKEN_TTL_SECONDS
      }
    );

    const refreshToken = jwt.sign(
      {
        type: "refresh",
        sid: input.sessionId,
        deviceId: input.deviceId
      },
      this.runtimeConfig.env.JWT_REFRESH_SECRET,
      {
        algorithm: "HS256",
        issuer: this.runtimeConfig.env.JWT_ISSUER,
        audience: this.runtimeConfig.env.JWT_AUDIENCE,
        subject: input.userId,
        jwtid: refreshJti,
        expiresIn: this.runtimeConfig.env.REFRESH_TOKEN_TTL_SECONDS
      }
    );

    return {
      accessToken,
      refreshToken,
      accessJti,
      refreshJti
    };
  }
}
