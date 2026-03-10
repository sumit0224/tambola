export type AccessTokenClaims = {
  sub: string;
  sid: string;
  jti: string;
  type: "access";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};

export type RefreshTokenClaims = {
  sub: string;
  sid: string;
  jti: string;
  type: "refresh";
  iss: string;
  aud: string;
  iat: number;
  exp: number;
};

export type SessionContext = {
  userId: string;
  sessionId: string;
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
};
