export const roomEventsTopic = "room-events";
export const gameEventsTopic = "game-events";
export const claimEventsTopic = "claim-events";
export const fraudEventsTopic = "fraud-events";

export const kafkaTopics = {
  roomEvents: roomEventsTopic,
  gameEvents: gameEventsTopic,
  claimEvents: claimEventsTopic,
  fraudEvents: fraudEventsTopic
} as const;

export type KafkaTopic = (typeof kafkaTopics)[keyof typeof kafkaTopics];

export type BackboneEventType =
  | "ROOM_CREATED"
  | "PLAYER_JOINED"
  | "GAME_STARTED"
  | "NUMBER_CALLED"
  | "CLAIM_ACCEPTED"
  | "GAME_ENDED";

export type RoomCreatedPayload = {
  roomCode: string;
  hostId: string;
  maxPlayers: number;
  callInterval: number;
  prizes: string[];
};

export type PlayerJoinedPayload = {
  userId: string;
  displayName: string;
  joinedAt: string;
  playerCount: number;
};

export type GameStartedPayload = {
  gameSessionId: string;
  seed: string;
  callIntervalSeconds: number;
  startedAt: string;
};

export type NumberCalledPayload = {
  number: number;
  callIndex: number;
  calledAt: string;
};

export type ClaimAcceptedPayload = {
  claimId: string;
  claimType: string;
  winner: {
    userId: string;
    displayName: string;
  };
  validatedAt: string;
};

export type GameEndedPayload = {
  reason: "FULL_HOUSE" | "ALL_CALLED" | "MANUAL";
  endedAt: string;
};

export type BackboneEventPayloadMap = {
  ROOM_CREATED: RoomCreatedPayload;
  PLAYER_JOINED: PlayerJoinedPayload;
  GAME_STARTED: GameStartedPayload;
  NUMBER_CALLED: NumberCalledPayload;
  CLAIM_ACCEPTED: ClaimAcceptedPayload;
  GAME_ENDED: GameEndedPayload;
};

export type BackboneEvent<TType extends BackboneEventType = BackboneEventType> = {
  eventId: string;
  roomId: string;
  offset: number;
  timestamp: string;
  type: TType;
  payload: BackboneEventPayloadMap[TType];
};

export type AnyBackboneEvent = {
  [K in BackboneEventType]: BackboneEvent<K>;
}[BackboneEventType];

export function makeBackboneEvent<TType extends BackboneEventType>(input: {
  eventId: string;
  roomId: string;
  offset: number;
  timestamp?: string;
  type: TType;
  payload: BackboneEventPayloadMap[TType];
}): BackboneEvent<TType> {
  return {
    eventId: input.eventId,
    roomId: input.roomId,
    offset: input.offset,
    timestamp: input.timestamp ?? new Date().toISOString(),
    type: input.type,
    payload: input.payload
  };
}
