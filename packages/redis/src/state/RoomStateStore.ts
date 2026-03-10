import type Redis from "ioredis";
import { redis, redisPublisher, redisSubscriber } from "../client";
import { redisKeys } from "../keys";

type RoomRuntimeState = {
  roomId: string;
  status: "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED";
  roomCode: string;
  callInterval: number;
  hostId: string;
  gameSessionId?: string;
  seed?: string;
  updatedAt: string;
};

type PresenceState = {
  connected: boolean;
  lastSeenAt: string;
  deviceId?: string;
  sessionId?: string;
};

const defaultLobbyTtlSeconds = Number(process.env.ROOM_STATE_TTL_SECONDS ?? 3600);

export class RoomStateStore {
  constructor(
    private readonly redisClient: Redis = redis,
    private readonly pubClient: Redis = redisPublisher,
    private readonly subClient: Redis = redisSubscriber
  ) {}

  async setRoomState(state: RoomRuntimeState, ttlSeconds = defaultLobbyTtlSeconds): Promise<void> {
    const key = redisKeys.roomState(state.roomId);

    await this.redisClient.multi().set(key, JSON.stringify(state)).expire(key, ttlSeconds).exec();
  }

  async getRoomState(roomId: string): Promise<RoomRuntimeState | null> {
    const raw = await this.redisClient.get(redisKeys.roomState(roomId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as RoomRuntimeState;
    } catch {
      return null;
    }
  }

  async linkRoomCode(roomCode: string, roomId: string, ttlSeconds = defaultLobbyTtlSeconds): Promise<void> {
    await this.redisClient.set(redisKeys.roomCodeLookup(roomCode), roomId, "EX", ttlSeconds);
  }

  async resolveRoomCode(roomCode: string): Promise<string | null> {
    return this.redisClient.get(redisKeys.roomCodeLookup(roomCode));
  }

  async addPlayer(roomId: string, user: { userId: string; displayName: string }, ttlSeconds = defaultLobbyTtlSeconds) {
    const key = redisKeys.roomPlayers(roomId);
    await this.redisClient.multi().hset(key, user.userId, JSON.stringify(user)).expire(key, ttlSeconds).exec();
  }

  async removePlayer(roomId: string, userId: string) {
    await this.redisClient.hdel(redisKeys.roomPlayers(roomId), userId);
    await this.redisClient.hdel(redisKeys.roomPresence(roomId), userId);
  }

  async listPlayers(roomId: string): Promise<Array<{ userId: string; displayName: string }>> {
    const values = await this.redisClient.hvals(redisKeys.roomPlayers(roomId));

    return values
      .map((value) => {
        try {
          return JSON.parse(value) as { userId: string; displayName: string };
        } catch {
          return null;
        }
      })
      .filter((value): value is { userId: string; displayName: string } => value !== null);
  }

  async appendCalledNumber(roomId: string, number: number, ttlSeconds = defaultLobbyTtlSeconds): Promise<number[]> {
    const key = redisKeys.roomCalledNumbers(roomId);

    await this.redisClient.multi().rpush(key, number).expire(key, ttlSeconds).exec();
    return this.getCalledNumbers(roomId);
  }

  async getCalledNumbers(roomId: string): Promise<number[]> {
    const values = await this.redisClient.lrange(redisKeys.roomCalledNumbers(roomId), 0, -1);
    return values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  }

  async setPresence(
    roomId: string,
    userId: string,
    presence: PresenceState,
    ttlSeconds = defaultLobbyTtlSeconds
  ): Promise<void> {
    const key = redisKeys.roomPresence(roomId);
    await this.redisClient.multi().hset(key, userId, JSON.stringify(presence)).expire(key, ttlSeconds).exec();
  }

  async getPresence(roomId: string, userId: string): Promise<PresenceState | null> {
    const raw = await this.redisClient.hget(redisKeys.roomPresence(roomId), userId);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as PresenceState;
    } catch {
      return null;
    }
  }

  async listPresence(roomId: string): Promise<Record<string, PresenceState>> {
    const raw = await this.redisClient.hgetall(redisKeys.roomPresence(roomId));
    const parsed: Record<string, PresenceState> = {};

    for (const [userId, value] of Object.entries(raw)) {
      try {
        parsed[userId] = JSON.parse(value) as PresenceState;
      } catch {
        // ignore malformed presence entry
      }
    }

    return parsed;
  }

  async incrementOffset(roomId: string): Promise<number> {
    return this.redisClient.incr(redisKeys.roomOffset(roomId));
  }

  async setOffset(roomId: string, offset: number) {
    await this.redisClient.set(redisKeys.roomOffset(roomId), String(offset));
  }

  async getOffset(roomId: string): Promise<number> {
    const raw = await this.redisClient.get(redisKeys.roomOffset(roomId));
    if (!raw) {
      return 0;
    }

    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  async saveSnapshot(roomId: string, snapshot: object, ttlSeconds = defaultLobbyTtlSeconds): Promise<void> {
    const key = redisKeys.roomSnapshot(roomId);
    await this.redisClient.multi().set(key, JSON.stringify(snapshot)).expire(key, ttlSeconds).exec();
  }

  async getSnapshot<T extends object>(roomId: string): Promise<T | null> {
    const raw = await this.redisClient.get(redisKeys.roomSnapshot(roomId));
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setLobbyTtl(roomId: string, ttlSeconds = defaultLobbyTtlSeconds): Promise<void> {
    const keys = [
      redisKeys.roomState(roomId),
      redisKeys.roomPlayers(roomId),
      redisKeys.roomCalledNumbers(roomId),
      redisKeys.roomPresence(roomId),
      redisKeys.roomOffset(roomId),
      redisKeys.roomSnapshot(roomId)
    ];

    const transaction = this.redisClient.multi();
    for (const key of keys) {
      transaction.expire(key, ttlSeconds);
    }

    await transaction.exec();
  }

  get publisher(): Redis {
    return this.pubClient;
  }

  get subscriber(): Redis {
    return this.subClient;
  }
}
