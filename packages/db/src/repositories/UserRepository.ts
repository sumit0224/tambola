import crypto from "node:crypto";
import { prisma } from "../client";

type CreateUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
  provider?: string;
  providerId?: string;
};

type CreateSessionInput = {
  sessionId?: string;
  userId: string;
  refreshToken: string;
  accessJti: string;
  deviceId: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  rotatedFromId?: string;
};

const db = prisma as any;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class UserRepository {
  async findByEmail(email: string) {
    return db.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return db.user.findUnique({ where: { id } });
  }

  async createUser(input: CreateUserInput) {
    return db.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
        provider: input.provider ?? "local",
        providerId: input.providerId
      }
    });
  }

  async touchLastSeen(userId: string) {
    return db.user.update({
      where: { id: userId },
      data: {
        lastSeenAt: new Date()
      }
    });
  }

  async recordDeviceFingerprint(input: {
    userId?: string;
    fingerprintHash: string;
    platform?: string;
    appVersion?: string;
    ipAddress?: string;
  }) {
    if (input.userId) {
      return db.deviceFingerprint.upsert({
        where: {
          userId_fingerprintHash: {
            userId: input.userId,
            fingerprintHash: input.fingerprintHash
          }
        },
        update: {
          platform: input.platform,
          appVersion: input.appVersion,
          lastSeenAt: new Date(),
          lastIpAddress: input.ipAddress
        },
        create: {
          userId: input.userId,
          fingerprintHash: input.fingerprintHash,
          platform: input.platform,
          appVersion: input.appVersion,
          lastIpAddress: input.ipAddress
        }
      });
    }

    return db.deviceFingerprint.create({
      data: {
        fingerprintHash: input.fingerprintHash,
        platform: input.platform,
        appVersion: input.appVersion,
        lastIpAddress: input.ipAddress
      }
    });
  }

  async createSession(input: CreateSessionInput) {
    return db.session.create({
      data: {
        id: input.sessionId,
        userId: input.userId,
        refreshTokenHash: hashToken(input.refreshToken),
        accessJti: input.accessJti,
        deviceId: input.deviceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        expiresAt: input.expiresAt,
        rotatedFromId: input.rotatedFromId
      }
    });
  }

  async getActiveSession(sessionId: string) {
    return db.session.findFirst({
      where: {
        id: sessionId,
        status: "ACTIVE",
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  async getActiveSessionByRefreshToken(refreshToken: string) {
    return db.session.findFirst({
      where: {
        refreshTokenHash: hashToken(refreshToken),
        status: "ACTIVE",
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  async rotateSession(input: {
    oldSessionId: string;
    newSessionId?: string;
    userId: string;
    refreshToken: string;
    accessJti: string;
    deviceId: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt: Date;
  }) {
    return db.$transaction(async (tx: any) => {
      await tx.session.update({
        where: { id: input.oldSessionId },
        data: {
          status: "REVOKED",
          revokedAt: new Date()
        }
      });

      return tx.session.create({
        data: {
          id: input.newSessionId,
          userId: input.userId,
          refreshTokenHash: hashToken(input.refreshToken),
          accessJti: input.accessJti,
          deviceId: input.deviceId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
          expiresAt: input.expiresAt,
          rotatedFromId: input.oldSessionId
        }
      });
    });
  }

  async revokeSession(sessionId: string) {
    return db.session.update({
      where: { id: sessionId },
      data: {
        status: "REVOKED",
        revokedAt: new Date()
      }
    });
  }
}
