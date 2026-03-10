import crypto from "node:crypto";
import { GameRepository, RoomRepository } from "@tambola/db";
import { KafkaEventBus, NoopEventBus } from "@tambola/events";
import { getServiceMetrics } from "@tambola/observability";
import { RoomStateStore } from "@tambola/redis";
import { makeBackboneEvent } from "@tambola/types";
import { buildDeterministicNumberOrder } from "../engine/DeterministicNumberOrder";

type EventBusLike = KafkaEventBus | NoopEventBus;

type ActiveLoopState = {
  roomId: string;
  gameSessionId: string;
  seed: string;
  callIntervalSeconds: number;
  queue: number[];
  paused: boolean;
  timer?: NodeJS.Timeout;
};

export class GameLoopWorker {
  private readonly loops = new Map<string, ActiveLoopState>();
  private readonly metrics = getServiceMetrics("game_orchestrator");

  constructor(
    private readonly deps: {
      eventBus: EventBusLike;
      gameRepository: GameRepository;
      roomRepository: RoomRepository;
      roomStateStore: RoomStateStore;
      snapshotEveryEvents: number;
      groupId: string;
      useKafkaEvents: boolean;
    }
  ) {}

  async initialize(): Promise<void> {
    await this.recoverRunningGames();

    if (!this.deps.useKafkaEvents) {
      return;
    }

    await this.deps.eventBus.subscribe({
      groupId: this.deps.groupId,
      topics: ["game-events"],
      handler: async ({ event }) => {
        if (event.type !== "GAME_STARTED") {
          return;
        }

        const payload = event.payload as {
          gameSessionId: string;
          seed: string;
          callIntervalSeconds: number;
        };

        await this.startLoop({
          roomId: event.roomId,
          gameSessionId: payload.gameSessionId,
          seed: payload.seed,
          callIntervalSeconds: payload.callIntervalSeconds
        });
      }
    });
  }

  async pauseGame(roomId: string): Promise<void> {
    const state = this.loops.get(roomId);
    if (!state) {
      return;
    }

    state.paused = true;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    await this.deps.gameRepository.updateGameSessionState({
      gameSessionId: state.gameSessionId,
      status: "PAUSED"
    });

    const roomState = await this.deps.roomStateStore.getRoomState(roomId);
    if (roomState) {
      await this.deps.roomStateStore.setRoomState({
        ...roomState,
        updatedAt: new Date().toISOString()
      });
    }
  }

  async resumeGame(roomId: string): Promise<void> {
    const state = this.loops.get(roomId);
    if (!state) {
      return;
    }

    state.paused = false;

    await this.deps.gameRepository.updateGameSessionState({
      gameSessionId: state.gameSessionId,
      status: "RUNNING"
    });

    this.scheduleTick(state);
  }

  async stopGame(roomId: string): Promise<void> {
    await this.endGame(roomId, "MANUAL");
  }

  private async recoverRunningGames(): Promise<void> {
    const running = await this.deps.gameRepository.listRunningGameSessions();

    for (const session of running) {
      await this.startLoop({
        roomId: session.roomId,
        gameSessionId: session.id,
        seed: session.rngSeed,
        callIntervalSeconds: session.callInterval
      });
    }
  }

  private async startLoop(input: {
    roomId: string;
    gameSessionId: string;
    seed: string;
    callIntervalSeconds: number;
  }): Promise<void> {
    const existing = this.loops.get(input.roomId);
    if (existing?.timer) {
      clearTimeout(existing.timer);
    }

    const calledNumbers = await this.deps.roomStateStore.getCalledNumbers(input.roomId);
    const fullQueue = buildDeterministicNumberOrder(input.seed);
    const queue = fullQueue.slice(calledNumbers.length);

    const state: ActiveLoopState = {
      roomId: input.roomId,
      gameSessionId: input.gameSessionId,
      seed: input.seed,
      callIntervalSeconds: input.callIntervalSeconds,
      queue,
      paused: false
    };

    this.loops.set(input.roomId, state);
    this.scheduleTick(state);
  }

  private scheduleTick(state: ActiveLoopState): void {
    if (state.paused) {
      return;
    }

    state.timer = setTimeout(() => {
      void this.tick(state.roomId);
    }, state.callIntervalSeconds * 1000);
  }

  private async tick(roomId: string): Promise<void> {
    const state = this.loops.get(roomId);
    if (!state || state.paused) {
      return;
    }

    const nextNumber = state.queue.shift();
    if (nextNumber === undefined) {
      await this.endGame(roomId, "ALL_CALLED");
      return;
    }

    const offset = await this.deps.roomStateStore.incrementOffset(roomId);
    const calledNumbers = await this.deps.roomStateStore.appendCalledNumber(roomId, nextNumber);

    const event = makeBackboneEvent({
      eventId: crypto.randomUUID(),
      roomId,
      offset,
      type: "NUMBER_CALLED",
      payload: {
        number: nextNumber,
        callIndex: calledNumbers.length,
        calledAt: new Date().toISOString()
      }
    });

    await this.deps.gameRepository.appendEvent({
      roomId,
      gameSessionId: state.gameSessionId,
      type: event.type,
      offset: event.offset,
      payload: event.payload,
      eventId: event.eventId,
      timestamp: event.timestamp
    });

    await this.deps.eventBus.publishByType(event);

    if (offset % this.deps.snapshotEveryEvents === 0) {
      const snapshot = {
        status: "ACTIVE",
        callInterval: state.callIntervalSeconds,
        paused: state.paused,
        lastCalledNumber: nextNumber
      };

      await this.deps.gameRepository.saveSnapshot({
        roomId,
        gameSessionId: state.gameSessionId,
        eventOffset: offset,
        gameState: snapshot,
        calledNumbers
      });

      await this.deps.roomStateStore.saveSnapshot(roomId, {
        roomId,
        gameState: snapshot,
        calledNumbers,
        offset,
        snapshotAt: new Date().toISOString()
      });
    }

    this.scheduleTick(state);
  }

  private async endGame(roomId: string, reason: "ALL_CALLED" | "MANUAL"): Promise<void> {
    const state = this.loops.get(roomId);
    if (!state) {
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = undefined;
    }

    this.loops.delete(roomId);

    await this.deps.gameRepository.updateGameSessionState({
      gameSessionId: state.gameSessionId,
      status: "ENDED"
    });

    await this.deps.roomRepository.setRoomStatus(roomId, "ENDED");

    const roomState = await this.deps.roomStateStore.getRoomState(roomId);
    if (roomState) {
      await this.deps.roomStateStore.setRoomState({
        ...roomState,
        status: "ENDED",
        updatedAt: new Date().toISOString()
      });
    }

    const offset = await this.deps.roomStateStore.incrementOffset(roomId);
    const event = makeBackboneEvent({
      eventId: crypto.randomUUID(),
      roomId,
      offset,
      type: "GAME_ENDED",
      payload: {
        reason,
        endedAt: new Date().toISOString()
      }
    });

    await this.deps.gameRepository.appendEvent({
      roomId,
      gameSessionId: state.gameSessionId,
      type: event.type,
      offset: event.offset,
      payload: event.payload,
      eventId: event.eventId,
      timestamp: event.timestamp
    });

    await this.deps.eventBus.publishByType(event);
  }
}
