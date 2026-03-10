import "socket.io";

declare module "socket.io" {
  interface Socket {
    data: {
      session?: {
        userId: string;
        sessionId: string;
        deviceId: string;
        displayName: string;
      };
    };
  }
}
