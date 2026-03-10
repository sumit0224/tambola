import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { AccessTokenClaims, RefreshTokenClaims } from "@tambola/types";

export type TokenConfig = {
  issuer: string;
  audience: string;
  accessSecret: string;
  refreshSecret: string;
  accessTtlSeconds: number;
  refreshTtlSeconds: number;
};

export type IssuedTokenPair = {
  accessToken: string;
  refreshToken: string;
  accessJti: string;
  refreshJti: string;
};

function toSecretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export class TokenService {
  private readonly accessSecret: Uint8Array;
  private readonly refreshSecret: Uint8Array;

  constructor(private readonly config: TokenConfig) {
    this.accessSecret = toSecretKey(config.accessSecret);
    this.refreshSecret = toSecretKey(config.refreshSecret);
  }

  async issuePair(input: { userId: string; sessionId: string; deviceId: string }): Promise<IssuedTokenPair> {
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessToken = await new SignJWT({
      type: "access",
      sid: input.sessionId,
      deviceId: input.deviceId
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setSubject(input.userId)
      .setJti(accessJti)
      .setIssuedAt()
      .setExpirationTime(`${this.config.accessTtlSeconds}s`)
      .sign(this.accessSecret);

    const refreshToken = await new SignJWT({
      type: "refresh",
      sid: input.sessionId,
      deviceId: input.deviceId
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setSubject(input.userId)
      .setJti(refreshJti)
      .setIssuedAt()
      .setExpirationTime(`${this.config.refreshTtlSeconds}s`)
      .sign(this.refreshSecret);

    return {
      accessToken,
      refreshToken,
      accessJti,
      refreshJti
    };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    const { payload } = await jwtVerify(token, this.accessSecret, {
      issuer: this.config.issuer,
      audience: this.config.audience
    });

    if (payload.type !== "access" || !payload.sub || !payload.sid || !payload.jti) {
      throw new Error("Invalid access token payload");
    }

    return {
      sub: payload.sub,
      sid: String(payload.sid),
      jti: payload.jti,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
      aud: this.config.audience,
      iss: this.config.issuer,
      type: "access"
    };
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
    const { payload } = await jwtVerify(token, this.refreshSecret, {
      issuer: this.config.issuer,
      audience: this.config.audience
    });

    if (payload.type !== "refresh" || !payload.sub || !payload.sid || !payload.jti) {
      throw new Error("Invalid refresh token payload");
    }

    return {
      sub: payload.sub,
      sid: String(payload.sid),
      jti: payload.jti,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
      aud: this.config.audience,
      iss: this.config.issuer,
      type: "refresh"
    };
  }
}
