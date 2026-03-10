import crypto from "node:crypto";
import type { Server } from "socket.io";
import { ClaimValidator } from "../claim/ClaimValidator";
import type { ClaimType } from "../claim/claim.types";
import { TicketService } from "../ticket/TicketService";
import type { Ticket } from "../ticket/ticket.types";
import { AppError } from "../common/errors";
import type { RequestUser } from "../auth/requestUser";
import { GameEngine } from "../engine/GameEngine";
import type { EngineEndReason, NumberCalledEvent } from "../engine/gameEngine.types";
import { GameStateStore, type StoredRoomState } from "../state/GameStateStore";

type RoomStatus = "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED";

type Winner = {
  userId: string;
  displayName: string;
};

type PresenceState = {
  connected: boolean;
  lastSeenAt: string;
};

type RoomRecord = {
  id: string;
  roomCode: string;
  host: Winner;
  status: RoomStatus;
  maxPlayers: number;
  callInterval: number;
  prizes: ClaimType[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  players: Map<string, Winner>;
  tickets: Map<string, Ticket>;
  calledNumbers: number[];
  winners: Map<ClaimType, Winner>;
  claimRate: Map<string, { count: number; windowStartMs: number }>;
  presence: Map<string, PresenceState>;
};

const DEFAULT_PRIZES: ClaimType[] = ["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "EARLY_FIVE", "FULL_HOUSE"];

export class GameApiService {
  private readonly ticketService = new TicketService();
  private readonly claimValidator = new ClaimValidator();
  private readonly engine: GameEngine;
  private readonly stateStore = new GameStateStore();

  constructor(private readonly io: Server) {
    this.engine = new GameEngine({
      onNumberCalled: (roomId, event) => {
        void this.handleNumberCalled(roomId, event);
      },
      onGameEnded: (roomId, reason) => {
        void this.handleEngineEnded(roomId, reason);
      }
    });
  }

  async createRoom(user: RequestUser, input: { maxPlayers: number; callInterval: number; prizes?: ClaimType[] }) {
    const roomId = crypto.randomUUID();
    const roomCode = await this.generateRoomCode();

    const room: RoomRecord = {
      id: roomId,
      roomCode,
      host: {
        userId: user.userId,
        displayName: user.displayName
      },
      status: "LOBBY",
      maxPlayers: input.maxPlayers,
      callInterval: input.callInterval,
      prizes: input.prizes?.length ? input.prizes : DEFAULT_PRIZES,
      createdAt: new Date().toISOString(),
      players: new Map([[user.userId, { userId: user.userId, displayName: user.displayName }]]),
      tickets: new Map(),
      calledNumbers: [],
      winners: new Map(),
      claimRate: new Map(),
      presence: new Map([[user.userId, { connected: false, lastSeenAt: new Date().toISOString() }]])
    };

    await this.stateStore.createRoom(this.toStoredRoom(room));

    return {
      roomId,
      roomCode,
      status: room.status
    };
  }

  async joinRoom(user: RequestUser, roomCode: string) {
    const room = await this.getRoomByCode(roomCode);

    if (room.status !== "LOBBY") {
      throw new AppError(409, "GAME_ALREADY_STARTED");
    }

    const alreadyJoined = room.players.has(user.userId);
    if (!alreadyJoined && room.players.size >= room.maxPlayers) {
      throw new AppError(409, "ROOM_FULL");
    }

    if (!alreadyJoined) {
      room.players.set(user.userId, {
        userId: user.userId,
        displayName: user.displayName
      });
      room.presence.set(user.userId, {
        connected: false,
        lastSeenAt: new Date().toISOString()
      });

      this.io.to(room.id).emit("player-joined", {
        userId: user.userId,
        displayName: user.displayName,
        playerCount: room.players.size
      });
    }

    await this.saveRoom(room);

    return {
      roomId: room.id,
      status: room.status,
      playerCount: room.players.size,
      host: room.host
    };
  }

  async startGame(user: RequestUser, roomId: string) {
    const room = await this.getRoom(roomId);

    if (room.host.userId !== user.userId) {
      throw new AppError(403, "NOT_HOST");
    }

    if (room.status !== "LOBBY") {
      throw new AppError(409, "ALREADY_STARTED");
    }

    if (room.players.size < 2) {
      throw new AppError(409, "NOT_ENOUGH_PLAYERS");
    }

    room.status = "ACTIVE";
    room.calledNumbers = [];
    room.winners.clear();
    room.claimRate.clear();

    const hashes = new Set<string>();
    for (const ticket of room.tickets.values()) {
      hashes.add(JSON.stringify(ticket.grid));
    }

    for (const player of room.players.values()) {
      const ticket = this.ticketService.generateUnique(room.id, player.userId, hashes);
      room.tickets.set(player.userId, ticket);
      this.io.to(`user:${player.userId}`).emit("ticket-assigned", {
        ticketId: ticket.id,
        grid: ticket.grid
      });
    }

    const start = this.engine.startGame({
      roomId: room.id,
      callIntervalSeconds: room.callInterval
    });

    room.startedAt = start.startedAt;
    await this.saveRoom(room);

    this.io.to(room.id).emit("game-started", {
      startedAt: room.startedAt,
      callInterval: room.callInterval,
      totalPlayers: room.players.size
    });

    return {
      startedAt: room.startedAt,
      totalPlayers: room.players.size
    };
  }

  async getTicket(user: RequestUser, roomId: string) {
    const room = await this.getRoom(roomId);
    const ticket = room.tickets.get(user.userId);

    if (!ticket) {
      throw new AppError(404, "TICKET_NOT_ASSIGNED");
    }

    return {
      ticketId: ticket.id,
      grid: ticket.grid
    };
  }

  async submitClaim(user: RequestUser, roomId: string, claimType: ClaimType) {
    const room = await this.getRoom(roomId);

    if (room.status !== "ACTIVE") {
      throw new AppError(409, "GAME_NOT_ACTIVE");
    }

    this.enforceClaimRateLimit(room, user.userId);

    const existingWinner = room.winners.get(claimType);
    if (existingWinner) {
      throw new AppError(409, "ALREADY_WON", { winner: existingWinner });
    }

    const ticket = room.tickets.get(user.userId);
    if (!ticket) {
      throw new AppError(404, "TICKET_NOT_ASSIGNED");
    }

    const result = this.claimValidator.validate(ticket.grid, new Set(room.calledNumbers), claimType);
    if (result.status === "INVALID") {
      throw new AppError(422, "INVALID_CLAIM", {
        reason: result.reason ?? "Claim is not valid"
      });
    }

    const winner = {
      userId: user.userId,
      displayName: room.players.get(user.userId)?.displayName ?? user.displayName
    };

    room.winners.set(claimType, winner);
    await this.saveRoom(room);

    this.io.to(room.id).emit("winner-announced", {
      claimType,
      winner
    });

    if (claimType === "FULL_HOUSE") {
      await this.endGame(room, "FULL_HOUSE");
    }

    return {
      status: "VALID" as const,
      prize: claimType,
      winner
    };
  }

  async getState(roomId: string) {
    const room = await this.getRoom(roomId);

    return {
      status: room.status,
      calledNumbers: room.calledNumbers,
      callIndex: room.calledNumbers.length,
      winners: this.getSerializedWinners(room)
    };
  }

  private ensureSocketJoinedRoom(room: RoomRecord, userId: string): void {
    if (!room.players.has(userId)) {
      throw new AppError(403, "NOT_IN_ROOM");
    }
  }

  async getSocketRoomJoinedPayload(user: RequestUser, roomId: string) {
    const room = await this.getRoom(roomId);
    this.ensureSocketJoinedRoom(room, user.userId);
    this.markConnected(room, user.userId);
    await this.saveRoom(room);

    return {
      roomId: room.id,
      roomCode: room.roomCode,
      status: room.status,
      players: Array.from(room.players.values()),
      config: {
        maxPlayers: room.maxPlayers,
        callInterval: room.callInterval,
        prizes: room.prizes
      }
    };
  }

  async getReconnectState(roomId: string, userId: string) {
    const room = await this.getRoom(roomId);
    this.ensureSocketJoinedRoom(room, userId);

    return {
      calledNumbers: room.calledNumbers,
      winners: this.getSerializedWinners(room),
      ticket: room.tickets.get(userId) ?? null
    };
  }

  async leaveSocketRoom(roomId: string, userId: string): Promise<void> {
    const room = await this.stateStore.getRoom(roomId).then((state) => (state ? this.toRoomRecord(state) : null));
    if (!room || !room.players.has(userId)) {
      return;
    }

    const presence = room.presence.get(userId);
    if (presence) {
      presence.connected = false;
      presence.lastSeenAt = new Date().toISOString();
      room.presence.set(userId, presence);
    }

    const player = room.players.get(userId);
    if (player) {
      this.io.to(room.id).emit("player-left", {
        userId,
        displayName: player.displayName,
        playerCount: this.getConnectedCount(room)
      });
    }

    await this.saveRoom(room);
  }

  async touchPresence(roomId: string, userId: string): Promise<void> {
    const room = await this.stateStore.getRoom(roomId).then((state) => (state ? this.toRoomRecord(state) : null));
    if (!room || !room.players.has(userId)) {
      return;
    }

    const presence = room.presence.get(userId) ?? {
      connected: true,
      lastSeenAt: new Date().toISOString()
    };

    presence.connected = true;
    presence.lastSeenAt = new Date().toISOString();
    room.presence.set(userId, presence);
    await this.saveRoom(room);
  }

  private markConnected(room: RoomRecord, userId: string): void {
    const presence = room.presence.get(userId) ?? {
      connected: true,
      lastSeenAt: new Date().toISOString()
    };

    presence.connected = true;
    presence.lastSeenAt = new Date().toISOString();
    room.presence.set(userId, presence);
  }

  private async getRoom(roomId: string): Promise<RoomRecord> {
    const stored = await this.stateStore.getRoom(roomId);
    if (!stored) {
      throw new AppError(404, "ROOM_NOT_FOUND");
    }

    return this.toRoomRecord(stored);
  }

  private async getRoomByCode(roomCode: string): Promise<RoomRecord> {
    const roomId = await this.stateStore.getRoomIdByCode(roomCode);
    if (!roomId) {
      throw new AppError(404, "ROOM_NOT_FOUND");
    }

    return this.getRoom(roomId);
  }

  private async generateRoomCode(): Promise<string> {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for (let attempt = 0; attempt < 32; attempt += 1) {
      let roomCode = "";
      for (let i = 0; i < 6; i += 1) {
        roomCode += alphabet[Math.floor(Math.random() * alphabet.length)];
      }

      const existing = await this.stateStore.getRoomIdByCode(roomCode);
      if (!existing) {
        return roomCode;
      }
    }

    throw new AppError(500, "ROOM_CODE_GENERATION_FAILED");
  }

  private enforceClaimRateLimit(room: RoomRecord, userId: string): void {
    const nowMs = Date.now();
    const current = room.claimRate.get(userId) ?? {
      count: 0,
      windowStartMs: nowMs
    };

    if (nowMs - current.windowStartMs >= 60_000) {
      current.count = 0;
      current.windowStartMs = nowMs;
    }

    if (current.count >= 5) {
      throw new AppError(429, "RATE_LIMITED");
    }

    current.count += 1;
    room.claimRate.set(userId, current);
  }

  private async handleNumberCalled(roomId: string, event: NumberCalledEvent): Promise<void> {
    const stored = await this.stateStore.getRoom(roomId);
    if (!stored) {
      return;
    }

    const room = this.toRoomRecord(stored);
    if (room.status !== "ACTIVE") {
      return;
    }

    room.calledNumbers.push(event.number);
    await this.saveRoom(room);

    this.io.to(room.id).emit("number-called", event);
  }

  private async handleEngineEnded(roomId: string, reason: EngineEndReason): Promise<void> {
    const stored = await this.stateStore.getRoom(roomId);
    if (!stored) {
      return;
    }

    const room = this.toRoomRecord(stored);
    if (room.status !== "ACTIVE") {
      return;
    }

    if (reason === "ALL_CALLED") {
      await this.endGame(room, "ALL_CALLED");
      return;
    }

    if (reason === "FULL_HOUSE") {
      await this.endGame(room, "FULL_HOUSE");
    }
  }

  private async endGame(room: RoomRecord, reason: "FULL_HOUSE" | "ALL_CALLED"): Promise<void> {
    if (room.status === "ENDED") {
      return;
    }

    this.engine.stopGame(room.id, "MANUAL");
    room.status = "ENDED";
    room.endedAt = new Date().toISOString();
    await this.saveRoom(room);

    this.io.to(room.id).emit("game-ended", {
      reason,
      endedAt: room.endedAt,
      winners: this.getSerializedWinners(room)
    });
  }

  private getSerializedWinners(room: RoomRecord) {
    return Array.from(room.winners.entries()).map(([claimType, winner]) => ({
      claimType,
      winner
    }));
  }

  private getConnectedCount(room: RoomRecord): number {
    let connected = 0;

    for (const presence of room.presence.values()) {
      if (presence.connected) {
        connected += 1;
      }
    }

    return connected;
  }

  private toStoredRoom(room: RoomRecord): StoredRoomState {
    return {
      id: room.id,
      roomCode: room.roomCode,
      host: room.host,
      status: room.status,
      maxPlayers: room.maxPlayers,
      callInterval: room.callInterval,
      prizes: room.prizes,
      createdAt: room.createdAt,
      startedAt: room.startedAt,
      endedAt: room.endedAt,
      players: Array.from(room.players.values()),
      tickets: Array.from(room.tickets.values()).map((ticket) => ({
        userId: ticket.userId,
        ticketId: ticket.id,
        grid: ticket.grid,
        createdAt: ticket.createdAt
      })),
      calledNumbers: room.calledNumbers,
      winners: this.getSerializedWinners(room),
      claimRate: Array.from(room.claimRate.entries()).map(([userId, rate]) => ({
        userId,
        count: rate.count,
        windowStartMs: rate.windowStartMs
      })),
      presence: Array.from(room.presence.entries()).map(([userId, presence]) => ({
        userId,
        connected: presence.connected,
        lastSeenAt: presence.lastSeenAt
      }))
    };
  }

  private toRoomRecord(state: StoredRoomState): RoomRecord {
    const players = new Map(state.players.map((player) => [player.userId, player]));
    const tickets = new Map(
      state.tickets.map((ticket) => [
        ticket.userId,
        {
          id: ticket.ticketId,
          roomId: state.id,
          userId: ticket.userId,
          grid: ticket.grid,
          createdAt: ticket.createdAt
        } satisfies Ticket
      ])
    );
    const winners = new Map(state.winners.map((entry) => [entry.claimType as ClaimType, entry.winner]));
    const claimRate = new Map(
      state.claimRate.map((entry) => [entry.userId, { count: entry.count, windowStartMs: entry.windowStartMs }])
    );
    const presence = new Map(
      state.presence.map((entry) => [entry.userId, { connected: entry.connected, lastSeenAt: entry.lastSeenAt }])
    );

    return {
      id: state.id,
      roomCode: state.roomCode,
      host: state.host,
      status: state.status,
      maxPlayers: state.maxPlayers,
      callInterval: state.callInterval,
      prizes: state.prizes as ClaimType[],
      createdAt: state.createdAt,
      startedAt: state.startedAt,
      endedAt: state.endedAt,
      players,
      tickets,
      calledNumbers: state.calledNumbers ?? [],
      winners,
      claimRate,
      presence
    };
  }

  private async saveRoom(room: RoomRecord): Promise<void> {
    await this.stateStore.saveRoom(this.toStoredRoom(room));
  }
}
