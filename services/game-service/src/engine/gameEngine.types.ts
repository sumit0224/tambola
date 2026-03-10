export type EngineEndReason = "FULL_HOUSE" | "ALL_CALLED" | "MANUAL";

export type NumberCalledEvent = {
  number: number;
  callIndex: number;
  calledAt: string;
};

export type GameEngineStartInput = {
  roomId: string;
  callIntervalSeconds: number;
  queue?: number[];
};

export type GameEngineCallbacks = {
  onNumberCalled: (roomId: string, event: NumberCalledEvent) => void;
  onGameEnded: (roomId: string, reason: EngineEndReason) => void;
};

export type GameEngineStartResult = {
  roomId: string;
  startedAt: string;
  callInterval: number;
};
