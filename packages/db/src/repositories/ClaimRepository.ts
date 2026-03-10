import { prisma } from "../client";

const db = prisma as any;

export class ClaimRepository {
  async createClaim(input: {
    roomId: string;
    userId: string;
    claimType: "TOP_ROW" | "MIDDLE_ROW" | "BOTTOM_ROW" | "EARLY_FIVE" | "FULL_HOUSE";
    calledNumbers: number[];
    eventOffset: number;
  }) {
    return db.claim.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        claimType: input.claimType,
        status: "PENDING",
        calledNumsSnapshot: input.calledNumbers,
        eventOffset: input.eventOffset
      }
    });
  }

  async markClaimInvalid(input: { claimId: string; reason: string }) {
    return db.claim.update({
      where: { id: input.claimId },
      data: {
        status: "INVALID",
        reason: input.reason,
        validatedAt: new Date()
      }
    });
  }

  async markClaimValid(input: {
    claimId: string;
    roomId: string;
    userId: string;
    claimType: "TOP_ROW" | "MIDDLE_ROW" | "BOTTOM_ROW" | "EARLY_FIVE" | "FULL_HOUSE";
  }) {
    return db.$transaction(async (tx: any) => {
      const claim = await tx.claim.update({
        where: { id: input.claimId },
        data: {
          status: "VALID",
          validatedAt: new Date()
        }
      });

      const winner = await tx.winner.create({
        data: {
          roomId: input.roomId,
          userId: input.userId,
          claimType: input.claimType,
          claimId: claim.id
        }
      });

      return {
        claim,
        winner
      };
    });
  }

  async getWinnerByClaimType(input: {
    roomId: string;
    claimType: "TOP_ROW" | "MIDDLE_ROW" | "BOTTOM_ROW" | "EARLY_FIVE" | "FULL_HOUSE";
  }) {
    return db.winner.findUnique({
      where: {
        roomId_claimType: {
          roomId: input.roomId,
          claimType: input.claimType
        }
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        }
      }
    });
  }

  async listWinners(roomId: string) {
    return db.winner.findMany({
      where: {
        roomId
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true
          }
        }
      },
      orderBy: {
        announcedAt: "asc"
      }
    });
  }

  async createFraudEvent(input: {
    roomId?: string;
    userId?: string;
    claimId?: string;
    eventType: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    score: number;
    payload: Record<string, unknown>;
  }) {
    return db.fraudEvent.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        claimId: input.claimId,
        eventType: input.eventType,
        severity: input.severity,
        score: input.score,
        payload: input.payload
      }
    });
  }

  async createRiskScore(input: {
    roomId?: string;
    userId: string;
    score: number;
    modelVersion: string;
    reasons: Record<string, unknown>;
  }) {
    return db.riskScore.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        score: input.score,
        modelVersion: input.modelVersion,
        reasons: input.reasons
      }
    });
  }

  async createEnforcementAction(input: {
    roomId?: string;
    userId: string;
    actionType: string;
    reason?: string;
    expiresAt?: Date;
  }) {
    return db.enforcementAction.create({
      data: {
        roomId: input.roomId,
        userId: input.userId,
        actionType: input.actionType,
        reason: input.reason,
        expiresAt: input.expiresAt
      }
    });
  }
}
