export type RoomStatus = "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED";

export type Room = {
  id: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: number;
  callInterval: number;
  createdAt: string;
};
