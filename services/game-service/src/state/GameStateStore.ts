import type Redis from "ioredis";
import { redis } from "@tambola/redis";

const ROOM_KEY_PREFIX = "tambola:game:room:";
const ROOM_CODE_PREFIX = "tambola:game:room-code:";

export type StoredWinner = {
  userId: string;
  displayName: string;
};

export type StoredPresence = {
  userId: string;
  connected: boolean;
  lastSeenAt: string;
};

export type StoredRoomState = {
  id: string;
  roomCode: string;
  host: StoredWinner;
  status: "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED";
  maxPlayers: number;
  callInterval: number;
  prizes: string[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  players: StoredWinner[];
  tickets: Array<{ userId: string; ticketId: string; grid: (number | null)[][]; createdAt: string }>;
  calledNumbers: number[];
  winners: Array<{ claimType: string; winner: StoredWinner }>;
  claimRate: Array<{ userId: string; count: number; windowStartMs: number }>;
  presence: StoredPresence[];
};

export class GameStateStore {
  constructor(private readonly redisClient: Redis = redis) {}

  async createRoom(state: StoredRoomState): Promise<void> {
    await this.redisClient.set(this.roomKey(state.id), JSON.stringify(state));
    await this.redisClient.set(this.roomCodeKey(state.roomCode), state.id);
  }

  async getRoom(roomId: string): Promise<StoredRoomState | null> {
    const raw = await this.redisClient.get(this.roomKey(roomId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredRoomState;
    } catch {
      return null;
    }
  }

  async getRoomIdByCode(roomCode: string): Promise<string | null> {
    return this.redisClient.get(this.roomCodeKey(roomCode));
  }

  async saveRoom(state: StoredRoomState): Promise<void> {
    await this.redisClient.set(this.roomKey(state.id), JSON.stringify(state));
  }

  async deleteRoom(roomId: string): Promise<void> {
    const state = await this.getRoom(roomId);
    if (state) {
      await this.redisClient.del(this.roomCodeKey(state.roomCode));
    }
    await this.redisClient.del(this.roomKey(roomId));
  }

  private roomKey(roomId: string): string {
    return `${ROOM_KEY_PREFIX}${roomId}`;
  }

  private roomCodeKey(roomCode: string): string {
    return `${ROOM_CODE_PREFIX}${roomCode}`;
  }
}
