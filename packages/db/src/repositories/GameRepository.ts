import crypto from "node:crypto";
import { prisma } from "../client";
import type { AnyBackboneEvent, BackboneEventType, RecoveryResponse, RoomSnapshot } from "@tambola/types";

const db = prisma as any;

export class GameRepository {
  async createGameSession(input: { roomId: string; callInterval: number; seed: string }) {
    return db.gameSession.create({
      data: {
        roomId: input.roomId,
        callInterval: input.callInterval,
        rngSeed: input.seed,
        status: "RUNNING",
        startedAt: new Date(),
        currentOffset: 0
      }
    });
  }

  async updateGameSessionState(input: {
    gameSessionId: string;
    status: "RUNNING" | "PAUSED" | "ENDED";
    currentOffset?: number;
  }) {
    return db.gameSession.update({
      where: {
        id: input.gameSessionId
      },
      data: {
        status: input.status,
        currentOffset: input.currentOffset,
        pausedAt: input.status === "PAUSED" ? new Date() : undefined,
        resumedAt: input.status === "RUNNING" ? new Date() : undefined,
        endedAt: input.status === "ENDED" ? new Date() : undefined
      }
    });
  }

  async getGameSessionById(gameSessionId: string) {
    return db.gameSession.findUnique({
      where: { id: gameSessionId },
      include: { room: true }
    });
  }

  async listRunningGameSessions(limit = 500) {
    return db.gameSession.findMany({
      where: { status: "RUNNING" },
      include: {
        room: true
      },
      take: limit,
      orderBy: {
        startedAt: "asc"
      }
    });
  }

  async appendEvent(input: {
    roomId: string;
    gameSessionId?: string;
    type: BackboneEventType;
    offset: number;
    payload: unknown;
    timestamp?: string;
    eventId?: string;
  }) {
    const eventId = input.eventId ?? crypto.randomUUID();

    return db.$transaction(async (tx: any) => {
      const event = await tx.gameEvent.create({
        data: {
          roomId: input.roomId,
          gameSessionId: input.gameSessionId,
          eventType: input.type,
          eventOffset: input.offset,
          eventId,
          occurredAt: input.timestamp ? new Date(input.timestamp) : new Date(),
          payload: input.payload
        }
      });

      if (input.gameSessionId) {
        await tx.gameSession.update({
          where: { id: input.gameSessionId },
          data: {
            currentOffset: input.offset
          }
        });
      }

      return event;
    });
  }

  async getLatestOffset(roomId: string): Promise<number> {
    const latest = await db.gameEvent.findFirst({
      where: { roomId },
      orderBy: {
        eventOffset: "desc"
      },
      select: {
        eventOffset: true
      }
    });

    return latest?.eventOffset ?? 0;
  }

  async saveSnapshot(input: {
    roomId: string;
    gameSessionId?: string;
    eventOffset: number;
    gameState: Record<string, unknown>;
    calledNumbers: number[];
  }) {
    return db.gameSnapshot.create({
      data: {
        roomId: input.roomId,
        gameSessionId: input.gameSessionId,
        eventOffset: input.eventOffset,
        gameState: input.gameState,
        calledNumbers: input.calledNumbers
      }
    });
  }

  async getLatestSnapshot(roomId: string): Promise<RoomSnapshot | null> {
    const snapshot = await db.gameSnapshot.findFirst({
      where: { roomId },
      orderBy: {
        eventOffset: "desc"
      },
      include: {
        room: {
          include: {
            winners: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!snapshot) {
      return null;
    }

    return {
      roomId,
      gameSessionId: snapshot.gameSessionId ?? null,
      status: snapshot.room.status,
      gameState: snapshot.gameState,
      calledNumbers: snapshot.calledNumbers,
      winners: snapshot.room.winners.map((winner: any) => ({
        claimType: winner.claimType,
        winner: {
          userId: winner.user.id,
          displayName: winner.user.displayName
        }
      })),
      offset: snapshot.eventOffset,
      snapshotAt: snapshot.createdAt.toISOString()
    };
  }

  async getEventsAfterOffset(roomId: string, offset: number): Promise<AnyBackboneEvent[]> {
    const events = await db.gameEvent.findMany({
      where: {
        roomId,
        eventOffset: {
          gt: offset
        }
      },
      orderBy: {
        eventOffset: "asc"
      }
    });

    return events.map((event: any) => ({
      eventId: event.eventId,
      roomId: event.roomId,
      offset: event.eventOffset,
      timestamp: event.occurredAt.toISOString(),
      type: event.eventType,
      payload: event.payload
    })) as AnyBackboneEvent[];
  }

  async getRecoveryState(input: { roomId: string; lastOffset: number | null }): Promise<RecoveryResponse> {
    const snapshot = await this.getLatestSnapshot(input.roomId);
    const snapshotOffset = snapshot?.offset ?? 0;
    const requestedOffset = input.lastOffset ?? 0;
    const baseOffset = Math.max(snapshotOffset, requestedOffset);
    const events = await this.getEventsAfterOffset(input.roomId, baseOffset);
    const latestOffset = events.at(-1)?.offset ?? snapshot?.offset ?? 0;

    return {
      snapshot,
      latestOffset,
      events
    };
  }
}
