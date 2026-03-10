export const SOCKET_EVENTS = {
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",
  PING_PRESENCE: "ping-presence",
  ROOM_JOINED: "room-joined",
  PLAYER_JOINED: "player-joined",
  PLAYER_LEFT: "player-left",
  GAME_STARTED: "game-started",
  TICKET_ASSIGNED: "ticket-assigned",
  NUMBER_CALLED: "number-called",
  WINNER_ANNOUNCED: "winner-announced",
  GAME_ENDED: "game-ended",
  RECONNECT_STATE: "reconnect-state",
  ERROR: "error"
} as const;
