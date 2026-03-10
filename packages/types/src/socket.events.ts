export const clientToServerEvents = {
  joinRoom: "join-room",
  leaveRoom: "leave-room",
  pingPresence: "ping-presence"
} as const;

export const serverToClientEvents = {
  roomJoined: "room-joined",
  playerJoined: "player-joined",
  playerLeft: "player-left",
  gameStarted: "game-started",
  ticketAssigned: "ticket-assigned",
  numberCalled: "number-called",
  winnerAnnounced: "winner-announced",
  gameEnded: "game-ended",
  reconnectState: "reconnect-state"
} as const;
