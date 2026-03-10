import type { Server, Socket } from "socket.io";
import { type RoomRepository, type GameRepository, type UserRepository } from "@tambola/db";
import { KafkaEventBus, NoopEventBus } from "@tambola/events";
import { getServiceMetrics } from "@tambola/observability";
import { RoomStateStore } from "@tambola/redis";
import { clientToServerEvents, serverToClientEvents, type AnyBackboneEvent, type KafkaTopic } from "@tambola/types";
import { AppError } from "../utils/AppError";

type EventBusLike = KafkaEventBus | NoopEventBus;

type JoinRoomPayload = {
  roomId?: string;
  roomCode?: string;
  lastOffset?: number;
};

type LeaveRoomPayload = {
  roomId: string;
};

type PresencePayload = {
  roomId: string;
};

export class RealtimeGateway {
  private readonly metrics = getServiceMetrics("realtime_gateway");

  constructor(
    private readonly deps: {
      io: Server;
      roomRepository: RoomRepository;
      gameRepository: GameRepository;
      userRepository: UserRepository;
      roomStateStore: RoomStateStore;
      eventBus: EventBusLike;
      consumerGroupId: string;
      useKafkaEvents: boolean;
    }
  ) {}

  initialize(): void {
    this.deps.io.on("connection", (socket) => {
      this.metrics.socketConnections.inc();
      const session = socket.data.session;
      if (!session) {
        socket.disconnect(true);
        return;
      }

      socket.join(`user:${session.userId}`);

      socket.on(clientToServerEvents.joinRoom, (payload: JoinRoomPayload) => {
        this.withErrorHandling(socket, async () => {
          this.metrics.socketEvents.inc({ event: clientToServerEvents.joinRoom });
          await this.handleJoinRoom(socket, payload);
        });
      });

      socket.on(clientToServerEvents.leaveRoom, (payload: LeaveRoomPayload) => {
        this.withErrorHandling(socket, async () => {
          this.metrics.socketEvents.inc({ event: clientToServerEvents.leaveRoom });
          await this.handleLeaveRoom(socket, payload);
        });
      });

      socket.on(clientToServerEvents.pingPresence, (payload: PresencePayload) => {
        this.withErrorHandling(socket, async () => {
          this.metrics.socketEvents.inc({ event: clientToServerEvents.pingPresence });
          await this.handlePresencePing(socket, payload);
        });
      });

      socket.on("disconnect", () => {
        this.metrics.socketConnections.dec();
        void this.handleDisconnect(socket);
      });
    });
  }

  async startEventFanout(): Promise<void> {
    if (!this.deps.useKafkaEvents) {
      return;
    }

    await this.deps.eventBus.subscribe({
      groupId: this.deps.consumerGroupId,
      topics: ["room-events", "game-events", "claim-events"] as KafkaTopic[],
      handler: async ({ event }) => {
        const start = Date.now();
        await this.broadcastEvent(event);
        this.metrics.broadcastLatencyMs.observe({ event: event.type }, Date.now() - start);
      }
    });
  }

  private async handleJoinRoom(socket: Socket, payload: JoinRoomPayload): Promise<void> {
    const session = socket.data.session;
    if (!session) {
      throw new AppError("UNAUTHORIZED", 401);
    }

    let roomId = payload.roomId;

    if (!roomId && payload.roomCode) {
      roomId = (await this.deps.roomStateStore.resolveRoomCode(payload.roomCode)) ?? undefined;

      if (!roomId) {
        const roomByCode = await this.deps.roomRepository.findByRoomCode(payload.roomCode);
        roomId = roomByCode?.id;
      }
    }

    if (!roomId) {
      throw new AppError("ROOM_NOT_FOUND", 404);
    }

    const room = await this.deps.roomRepository.findById(roomId);
    if (!room) {
      throw new AppError("ROOM_NOT_FOUND", 404);
    }

    let isPlayer = room.players.some((player: any) => player.userId === session.userId && player.isActive);

    if (!isPlayer && room.status === "LOBBY") {
      await this.deps.roomRepository.addPlayer(room.id, session.userId);
      await this.deps.roomStateStore.addPlayer(room.id, {
        userId: session.userId,
        displayName: session.displayName
      });
      isPlayer = true;
    }

    if (!isPlayer) {
      throw new AppError("NOT_IN_ROOM", 403);
    }

    socket.join(room.id);

    await this.deps.roomStateStore.setPresence(room.id, session.userId, {
      connected: true,
      lastSeenAt: new Date().toISOString(),
      deviceId: session.deviceId,
      sessionId: session.sessionId
    });

    const players = await this.deps.roomStateStore.listPlayers(room.id);

    socket.emit(serverToClientEvents.roomJoined, {
      roomId: room.id,
      roomCode: room.roomCode,
      status: room.status,
      players: players.length ? players : room.players.map((player: any) => ({
        userId: player.user.id,
        displayName: player.user.displayName
      })),
      config: {
        maxPlayers: room.maxPlayers,
        callInterval: room.callInterval,
        prizes: (room.config as any)?.prizes ?? []
      }
    });

    if (room.status !== "LOBBY") {
      const recovery = await this.deps.gameRepository.getRecoveryState({
        roomId: room.id,
        lastOffset: payload.lastOffset ?? null
      });

      const calledFromEvents = recovery.events
        .filter((event) => event.type === "NUMBER_CALLED")
        .map((event: any) => Number(event.payload.number))
        .filter((value) => Number.isFinite(value));

      const snapshotCalled = recovery.snapshot?.calledNumbers ?? [];

      socket.emit(serverToClientEvents.reconnectState, {
        snapshot: recovery.snapshot,
        latestOffset: recovery.latestOffset,
        events: recovery.events,
        calledNumbers: Array.from(new Set([...snapshotCalled, ...calledFromEvents])),
        winners: recovery.snapshot?.winners ?? []
      });
    }
  }

  private async handleLeaveRoom(socket: Socket, payload: LeaveRoomPayload): Promise<void> {
    const session = socket.data.session;
    if (!session) {
      return;
    }

    socket.leave(payload.roomId);
    await this.deps.roomStateStore.setPresence(payload.roomId, session.userId, {
      connected: false,
      lastSeenAt: new Date().toISOString(),
      deviceId: session.deviceId,
      sessionId: session.sessionId
    });
  }

  private async handlePresencePing(socket: Socket, payload: PresencePayload): Promise<void> {
    const session = socket.data.session;
    if (!session) {
      return;
    }

    await this.deps.roomStateStore.setPresence(payload.roomId, session.userId, {
      connected: true,
      lastSeenAt: new Date().toISOString(),
      deviceId: session.deviceId,
      sessionId: session.sessionId
    });
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const session = socket.data.session;
    if (!session) {
      return;
    }

    for (const room of socket.rooms) {
      if (room.startsWith("user:")) {
        continue;
      }

      await this.deps.roomStateStore.setPresence(room, session.userId, {
        connected: false,
        lastSeenAt: new Date().toISOString(),
        deviceId: session.deviceId,
        sessionId: session.sessionId
      });
    }
  }

  private async broadcastEvent(event: AnyBackboneEvent): Promise<void> {
    switch (event.type) {
      case "PLAYER_JOINED": {
        this.deps.io.to(event.roomId).emit(serverToClientEvents.playerJoined, event.payload);
        return;
      }
      case "GAME_STARTED": {
        this.deps.io.to(event.roomId).emit(serverToClientEvents.gameStarted, event.payload);
        return;
      }
      case "NUMBER_CALLED": {
        this.deps.io.to(event.roomId).emit(serverToClientEvents.numberCalled, event.payload);
        return;
      }
      case "CLAIM_ACCEPTED": {
        this.deps.io.to(event.roomId).emit(serverToClientEvents.winnerAnnounced, {
          claimType: (event.payload as any).claimType,
          winner: (event.payload as any).winner
        });
        return;
      }
      case "GAME_ENDED": {
        this.deps.io.to(event.roomId).emit(serverToClientEvents.gameEnded, event.payload);
        return;
      }
      default:
        return;
    }
  }

  private withErrorHandling(socket: Socket, fn: () => Promise<void>): void {
    void fn().catch((error) => {
      if (error instanceof AppError) {
        socket.emit("error", {
          code: error.code,
          ...(error.details ?? {})
        });
        return;
      }

      socket.emit("error", { code: "INTERNAL_SERVER_ERROR" });
    });
  }
}
