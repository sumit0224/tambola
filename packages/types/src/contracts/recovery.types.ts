import type { AnyBackboneEvent } from "./backbone.events";

export type RoomSnapshot = {
  roomId: string;
  gameSessionId: string | null;
  status: "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED";
  gameState: {
    callInterval: number;
    paused: boolean;
    lastCalledNumber: number | null;
  };
  calledNumbers: number[];
  winners: Array<{
    claimType: string;
    winner: {
      userId: string;
      displayName: string;
    };
  }>;
  offset: number;
  snapshotAt: string;
};

export type RecoveryRequest = {
  roomId: string;
  lastOffset: number | null;
};

export type RecoveryResponse = {
  snapshot: RoomSnapshot | null;
  latestOffset: number;
  events: AnyBackboneEvent[];
};
