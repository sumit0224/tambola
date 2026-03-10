import { io, type Socket } from "socket.io-client";
import type { ClaimType } from "./api";

export type ServerEvents = {
  "room-joined": (payload: {
    roomId: string;
    roomCode?: string;
    status?: "LOBBY" | "ACTIVE" | "ENDED";
    players?: Array<{ userId: string; displayName: string }>;
    config?: { maxPlayers: number; callInterval: number };
  }) => void;
  "player-joined": (payload: { userId: string; displayName: string; playerCount?: number }) => void;
  "game-started": (payload: { startedAt: string; callInterval: number; totalPlayers: number }) => void;
  "ticket-assigned": (payload: { ticketId?: string; grid: (number | null)[][] }) => void;
  "number-called": (payload: { number: number; callIndex: number; calledAt: string }) => void;
  "winner-announced": (payload: {
    claimType: ClaimType;
    winner: { userId: string; displayName: string };
  }) => void;
  "game-ended": (payload: {
    reason: string;
    winners?: Array<{ claimType: ClaimType; winner: { userId: string; displayName: string } }>;
  }) => void;
  "reconnect-state": (payload: {
    calledNumbers?: number[];
    winners?: Array<{ claimType: ClaimType; winner: { userId: string; displayName: string } }>;
    ticket?: { grid: (number | null)[][] };
  }) => void;
  error: (payload: { code?: string; message?: string }) => void;
};

type ServerEventName = keyof ServerEvents;

let socket: Socket | null = null;
let currentToken: string | null = null;

const socketURL =
  process.env.EXPO_PUBLIC_GAME_BASE_URL?.replace(/\/v1$/, "") ?? "http://localhost:3003";

export function connectSocket(token: string, displayName: string): Socket {
  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(socketURL, {
    transports: ["websocket"],
    auth: {
      token,
      displayName
    },
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000
  });

  currentToken = token;
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
  }

  socket = null;
  currentToken = null;
}

export function emitSocket(event: string, payload?: object): void {
  socket?.emit(event, payload);
}

export function onSocketEvent<K extends ServerEventName>(event: K, handler: ServerEvents[K]): () => void {
  if (!socket) {
    return () => undefined;
  }

  const listener = handler as (...args: any[]) => void;
  socket.on(event as string, listener);
  return () => {
    socket?.off(event as string, listener);
  };
}
