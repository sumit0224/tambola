import { prisma } from "../client";

const db = prisma as any;

type CreateRoomInput = {
  roomCode: string;
  hostId: string;
  maxPlayers: number;
  callInterval: number;
  prizes: string[];
};

export class RoomRepository {
  async createRoom(input: CreateRoomInput) {
    return db.room.create({
      data: {
        roomCode: input.roomCode,
        hostId: input.hostId,
        maxPlayers: input.maxPlayers,
        callInterval: input.callInterval,
        config: {
          prizes: input.prizes
        },
        players: {
          create: {
            userId: input.hostId,
            isActive: true
          }
        }
      },
      include: {
        players: true
      }
    });
  }

  async findByRoomCode(roomCode: string) {
    return db.room.findUnique({
      where: { roomCode },
      include: {
        players: {
          where: { isActive: true },
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
    });
  }

  async findById(roomId: string) {
    return db.room.findUnique({
      where: { id: roomId },
      include: {
        players: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                displayName: true
              }
            }
          }
        },
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
    });
  }

  async addPlayer(roomId: string, userId: string) {
    return db.roomPlayer.upsert({
      where: {
        roomId_userId: {
          roomId,
          userId
        }
      },
      update: {
        isActive: true,
        leftAt: null
      },
      create: {
        roomId,
        userId,
        isActive: true
      }
    });
  }

  async removePlayer(roomId: string, userId: string) {
    return db.roomPlayer.updateMany({
      where: {
        roomId,
        userId,
        isActive: true
      },
      data: {
        isActive: false,
        leftAt: new Date()
      }
    });
  }

  async setRoomStatus(roomId: string, status: "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED") {
    return db.room.update({
      where: { id: roomId },
      data: {
        status,
        startedAt: status === "ACTIVE" ? new Date() : undefined,
        endedAt: status === "ENDED" || status === "EXPIRED" ? new Date() : undefined
      }
    });
  }

  async getActivePlayersCount(roomId: string): Promise<number> {
    return db.roomPlayer.count({
      where: {
        roomId,
        isActive: true
      }
    });
  }

  async listRoomPlayers(roomId: string) {
    return db.roomPlayer.findMany({
      where: {
        roomId,
        isActive: true
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
        joinedAt: "asc"
      }
    });
  }
}
