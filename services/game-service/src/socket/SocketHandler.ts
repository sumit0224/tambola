import type { Server } from "socket.io";
import type { GameApiService } from "../services/GameApiService";
import { AppError } from "../common/errors";
import { SOCKET_EVENTS } from "./events";

type JoinRoomPayload = {
  roomId?: string;
  roomCode?: string;
};

type LeaveRoomPayload = {
  roomId: string;
};

type PresencePayload = {
  roomId: string;
};

export class SocketHandler {
  constructor(private readonly gameApi: GameApiService) {}

  initialize(io: Server) {
    io.on("connection", (socket) => {
      const userId = socket.data.userId as string;
      const displayName = socket.data.displayName as string;

      socket.join(`user:${userId}`);

      socket.on(SOCKET_EVENTS.JOIN_ROOM, (payload: JoinRoomPayload) => {
        this.withErrorHandling(socket, async () => {
          if (payload.roomCode) {
            const joinResult = await this.gameApi.joinRoom({ userId, displayName }, payload.roomCode);
            socket.join(joinResult.roomId);

            const roomJoined = await this.gameApi.getSocketRoomJoinedPayload(
              { userId, displayName },
              joinResult.roomId
            );
            socket.emit(SOCKET_EVENTS.ROOM_JOINED, roomJoined);

            if (roomJoined.status !== "LOBBY") {
              const reconnect = await this.gameApi.getReconnectState(joinResult.roomId, userId);
              socket.emit(SOCKET_EVENTS.RECONNECT_STATE, reconnect);
            }

            return;
          }

          if (payload.roomId) {
            const roomJoined = await this.gameApi.getSocketRoomJoinedPayload({ userId, displayName }, payload.roomId);
            socket.join(payload.roomId);
            socket.emit(SOCKET_EVENTS.ROOM_JOINED, roomJoined);

            if (roomJoined.status !== "LOBBY") {
              const reconnect = await this.gameApi.getReconnectState(payload.roomId, userId);
              socket.emit(SOCKET_EVENTS.RECONNECT_STATE, reconnect);
            }

            return;
          }

          throw new AppError(400, "INVALID_JOIN_PAYLOAD", {
            message: "Provide either roomCode or roomId"
          });
        });
      });

      socket.on(SOCKET_EVENTS.LEAVE_ROOM, (payload: LeaveRoomPayload) => {
        this.withErrorHandling(socket, async () => {
          socket.leave(payload.roomId);
          await this.gameApi.leaveSocketRoom(payload.roomId, userId);
        });
      });

      socket.on(SOCKET_EVENTS.PING_PRESENCE, (payload: PresencePayload) => {
        this.withErrorHandling(socket, async () => {
          await this.gameApi.touchPresence(payload.roomId, userId);
        });
      });

      socket.on("disconnect", () => {
        void (async () => {
          for (const room of socket.rooms) {
            if (room.startsWith("user:")) {
              continue;
            }

            await this.gameApi.leaveSocketRoom(room, userId);
          }
        })();
      });
    });
  }

  private withErrorHandling(
    socket: { emit: (event: string, payload: unknown) => void },
    fn: () => Promise<void> | void
  ): void {
    Promise.resolve(fn()).catch((error) => {
      if (error instanceof AppError) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: error.code,
          ...error.details
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.ERROR, {
        code: "INTERNAL_SERVER_ERROR"
      });
    });
  }
}
