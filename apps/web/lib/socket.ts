import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;
let activeToken: string | null = null;

export function createSocket(token: string, displayName: string): Socket {
  const endpoint = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:3003";

  if (socket && socket.connected && activeToken === token) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  socket = io(endpoint, {
    auth: { token, displayName },
    transports: ["websocket"],
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30_000
  });

  activeToken = token;
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  activeToken = null;

  if (typeof window !== "undefined") {
    const keysToDelete: string[] = [];

    for (let idx = 0; idx < window.localStorage.length; idx += 1) {
      const key = window.localStorage.key(idx);
      if (key && key.startsWith("tambola.room.")) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => window.localStorage.removeItem(key));
  }
}
