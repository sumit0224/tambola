import crypto from "node:crypto";
import {
  ClaimRepository,
  GameRepository,
  RoomRepository,
  UserRepository
} from "@tambola/db";
import { type KafkaEventBus, type NoopEventBus } from "@tambola/events";
import { RoomStateStore } from "@tambola/redis";
import {
  makeBackboneEvent,
  type BackboneEventType,
  type ClaimAcceptedPayload,
  type RecoveryResponse
} from "@tambola/types";
import { generateRoomCode } from "../utils/roomCode";
import { AppError } from "../utils/AppError";
import { FraudScoringService } from "../fraud/FraudScoringService";

type EventBusLike = KafkaEventBus | NoopEventBus;

const DEFAULT_PRIZES = ["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "EARLY_FIVE", "FULL_HOUSE"];

export class RoomBackboneService {
  constructor(
    private readonly deps: {
      roomRepository: RoomRepository;
      gameRepository: GameRepository;
      claimRepository: ClaimRepository;
      userRepository: UserRepository;
      roomStateStore: RoomStateStore;
      eventBus: EventBusLike;
      fraudScoringService: FraudScoringService;
      snapshotEveryEvents: number;
    }
  ) {}

  async createRoom(input: {
    userId: string;
    maxPlayers: number;
    callInterval: number;
    prizes?: string[];
  }): Promise<{ roomId: string; roomCode: string; status: string }> {
    let roomCode = "";

    for (let attempt = 0; attempt < 32; attempt += 1) {
      const code = generateRoomCode(6);
      const existing = await this.deps.roomRepository.findByRoomCode(code);
      if (!existing) {
        roomCode = code;
        break;
      }
    }

    if (!roomCode) {
      throw new AppError(500, "ROOM_CODE_GENERATION_FAILED");
    }

    const room = await this.deps.roomRepository.createRoom({
      roomCode,
      hostId: input.userId,
      maxPlayers: input.maxPlayers,
      callInterval: input.callInterval,
      prizes: input.prizes?.length ? input.prizes : DEFAULT_PRIZES
    });

    await this.deps.roomStateStore.setRoomState({
      roomId: room.id,
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: room.status,
      callInterval: room.callInterval,
      updatedAt: new Date().toISOString()
    });

    await this.deps.roomStateStore.linkRoomCode(room.roomCode, room.id);

    const hostUser = await this.deps.userRepository.findById(input.userId);
    if (hostUser) {
      await this.deps.roomStateStore.addPlayer(room.id, {
        userId: hostUser.id,
        displayName: hostUser.displayName
      });
    }

    await this.appendAndPublishEvent({
      roomId: room.id,
      gameSessionId: undefined,
      type: "ROOM_CREATED",
      payload: {
        roomCode: room.roomCode,
        hostId: room.hostId,
        maxPlayers: room.maxPlayers,
        callInterval: room.callInterval,
        prizes: input.prizes?.length ? input.prizes : DEFAULT_PRIZES
      }
    });

    return {
      roomId: room.id,
      roomCode: room.roomCode,
      status: room.status
    };
  }

  async joinRoom(input: { userId: string; roomCode: string }): Promise<{
    roomId: string;
    status: string;
    playerCount: number;
    host: { userId: string; displayName: string };
  }> {
    const roomId = (await this.deps.roomStateStore.resolveRoomCode(input.roomCode)) ?? undefined;
    const room = roomId
      ? await this.deps.roomRepository.findById(roomId)
      : await this.deps.roomRepository.findByRoomCode(input.roomCode);

    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND");
    }

    if (room.status !== "LOBBY") {
      throw new AppError(409, "GAME_ALREADY_STARTED");
    }

    const isAlreadyJoined = room.players.some((player: any) => player.userId === input.userId && player.isActive);
    const activePlayerCount = room.players.filter((player: any) => player.isActive).length;

    if (!isAlreadyJoined && activePlayerCount >= room.maxPlayers) {
      throw new AppError(409, "ROOM_FULL");
    }

    if (!isAlreadyJoined) {
      await this.deps.roomRepository.addPlayer(room.id, input.userId);
      const user = await this.deps.userRepository.findById(input.userId);
      await this.deps.roomStateStore.addPlayer(room.id, {
        userId: input.userId,
        displayName: user?.displayName ?? "Player"
      });

      await this.appendAndPublishEvent({
        roomId: room.id,
        gameSessionId: undefined,
        type: "PLAYER_JOINED",
        payload: {
          userId: input.userId,
          displayName: user?.displayName ?? "Player",
          joinedAt: new Date().toISOString(),
          playerCount: activePlayerCount + 1
        }
      });
    }

    const host = await this.deps.userRepository.findById(room.hostId);

    return {
      roomId: room.id,
      status: room.status,
      playerCount: await this.deps.roomRepository.getActivePlayersCount(room.id),
      host: {
        userId: room.hostId,
        displayName: host?.displayName ?? "Host"
      }
    };
  }

  async startGame(input: { roomId: string; hostUserId: string }): Promise<{ startedAt: string; totalPlayers: number }> {
    const room = await this.deps.roomRepository.findById(input.roomId);
    if (!room) {
      throw new AppError(404, "ROOM_NOT_FOUND");
    }

    if (room.hostId !== input.hostUserId) {
      throw new AppError(403, "NOT_HOST");
    }

    if (room.status !== "LOBBY") {
      throw new AppError(409, "ALREADY_STARTED");
    }

    const players = room.players.filter((player: any) => player.isActive);
    if (players.length < 2) {
      throw new AppError(409, "NOT_ENOUGH_PLAYERS");
    }

    await this.deps.roomRepository.setRoomStatus(room.id, "ACTIVE");

    const seed = crypto.randomUUID().replace(/-/g, "");
    const gameSession = await this.deps.gameRepository.createGameSession({
      roomId: room.id,
      callInterval: room.callInterval,
      seed
    });

    await this.deps.roomStateStore.setOffset(room.id, 0);
    await this.deps.roomStateStore.setRoomState({
      roomId: room.id,
      roomCode: room.roomCode,
      hostId: room.hostId,
      status: "ACTIVE",
      callInterval: room.callInterval,
      gameSessionId: gameSession.id,
      seed,
      updatedAt: new Date().toISOString()
    });

    const startedAt = new Date().toISOString();

    await this.appendAndPublishEvent({
      roomId: room.id,
      gameSessionId: gameSession.id,
      type: "GAME_STARTED",
      payload: {
        gameSessionId: gameSession.id,
        seed,
        callIntervalSeconds: room.callInterval,
        startedAt
      }
    });

    return {
      startedAt,
      totalPlayers: players.length
    };
  }

  async getRoomState(roomId: string) {
    const state = await this.deps.roomStateStore.getRoomState(roomId);
    const calledNumbers = await this.deps.roomStateStore.getCalledNumbers(roomId);
    const winners = await this.deps.claimRepository.listWinners(roomId);

    if (!state) {
      const room = await this.deps.roomRepository.findById(roomId);
      if (!room) {
        throw new AppError(404, "ROOM_NOT_FOUND");
      }

      return {
        status: room.status,
        calledNumbers,
        callIndex: calledNumbers.length,
        winners: winners.map((winner: any) => ({
          claimType: winner.claimType,
          winner: {
            userId: winner.user.id,
            displayName: winner.user.displayName
          }
        }))
      };
    }

    return {
      status: state.status,
      calledNumbers,
      callIndex: calledNumbers.length,
      winners: winners.map((winner: any) => ({
        claimType: winner.claimType,
        winner: {
          userId: winner.user.id,
          displayName: winner.user.displayName
        }
      }))
    };
  }

  async getRecovery(roomId: string, lastOffset: number | null): Promise<RecoveryResponse> {
    return this.deps.gameRepository.getRecoveryState({ roomId, lastOffset });
  }

  async evaluateFraud(input: {
    roomId: string;
    userId: string;
    claimLatencyMs: number;
    invalidClaimRatio: number;
    multiDeviceAnomaly: number;
    ipChurn: number;
  }) {
    return this.deps.fraudScoringService.evaluateClaim(input);
  }

  private async appendAndPublishEvent<TType extends BackboneEventType>(input: {
    roomId: string;
    gameSessionId?: string;
    type: TType;
    payload:
      | ClaimAcceptedPayload
      | Record<string, unknown>
      | {
          gameSessionId: string;
          seed: string;
          callIntervalSeconds: number;
          startedAt: string;
        };
  }) {
    const offset = await this.deps.roomStateStore.incrementOffset(input.roomId);
    const event = makeBackboneEvent({
      eventId: crypto.randomUUID(),
      roomId: input.roomId,
      offset,
      type: input.type,
      payload: input.payload as any
    });

    await this.deps.gameRepository.appendEvent({
      roomId: input.roomId,
      gameSessionId: input.gameSessionId,
      type: input.type,
      offset,
      payload: input.payload,
      eventId: event.eventId,
      timestamp: event.timestamp
    });

    await this.deps.eventBus.publishByType(event as any);

    if (offset % this.deps.snapshotEveryEvents === 0) {
      const calledNumbers = await this.deps.roomStateStore.getCalledNumbers(input.roomId);
      const state = await this.deps.roomStateStore.getRoomState(input.roomId);

      await this.deps.gameRepository.saveSnapshot({
        roomId: input.roomId,
        gameSessionId: input.gameSessionId,
        eventOffset: offset,
        gameState: {
          status: state?.status ?? "LOBBY",
          callInterval: state?.callInterval ?? 5,
          paused: false,
          lastCalledNumber: calledNumbers.at(-1) ?? null
        },
        calledNumbers
      });
    }
  }
}
