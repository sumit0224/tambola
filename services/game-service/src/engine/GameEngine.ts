import { shuffleNumbers } from "./NumberCaller";
import type {
  EngineEndReason,
  GameEngineCallbacks,
  GameEngineStartInput,
  GameEngineStartResult,
  NumberCalledEvent
} from "./gameEngine.types";

type EngineRoomState = {
  roomId: string;
  callIntervalMs: number;
  queue: number[];
  called: number[];
  timer?: NodeJS.Timeout;
};

export class GameEngine {
  private readonly rooms = new Map<string, EngineRoomState>();

  constructor(private readonly callbacks: GameEngineCallbacks) {}

  startGame(input: GameEngineStartInput): GameEngineStartResult {
    this.stopGame(input.roomId, "MANUAL");

    const state: EngineRoomState = {
      roomId: input.roomId,
      callIntervalMs: input.callIntervalSeconds * 1000,
      queue: input.queue ? input.queue.slice() : shuffleNumbers(),
      called: []
    };

    this.rooms.set(input.roomId, state);
    this.scheduleNextTick(input.roomId);

    return {
      roomId: input.roomId,
      startedAt: new Date().toISOString(),
      callInterval: input.callIntervalSeconds
    };
  }

  stopGame(roomId: string, reason: EngineEndReason): void {
    const state = this.rooms.get(roomId);
    if (!state) {
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
    }

    this.rooms.delete(roomId);

    if (reason !== "MANUAL") {
      this.callbacks.onGameEnded(roomId, reason);
    }
  }

  getCalledNumbers(roomId: string): number[] {
    return this.rooms.get(roomId)?.called.slice() ?? [];
  }

  isRunning(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  private scheduleNextTick(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state) {
      return;
    }

    state.timer = setTimeout(() => {
      this.tick(roomId);
    }, state.callIntervalMs);
  }

  private tick(roomId: string): void {
    const state = this.rooms.get(roomId);
    if (!state) {
      return;
    }

    const nextNumber = state.queue.shift();
    if (nextNumber === undefined) {
      this.stopGame(roomId, "ALL_CALLED");
      return;
    }

    state.called.push(nextNumber);

    const event: NumberCalledEvent = {
      number: nextNumber,
      callIndex: state.called.length,
      calledAt: new Date().toISOString()
    };

    this.callbacks.onNumberCalled(roomId, event);

    if (!this.rooms.has(roomId)) {
      return;
    }

    this.scheduleNextTick(roomId);
  }
}
