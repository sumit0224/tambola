export type RoomStatus = "LOBBY" | "ACTIVE" | "ENDED" | "EXPIRED";

export type RoomConfig = {
  maxPlayers: number;
  callInterval: number;
  prizes: string[];
};

export type Room = {
  id: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  config: RoomConfig;
};
