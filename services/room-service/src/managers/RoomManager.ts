import type { Room } from "../models/room.model";

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  createRoom(hostId: string, config: { maxPlayers: number; callInterval: number }): Room {
    const room: Room = {
      id: crypto.randomUUID(),
      roomCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
      hostId,
      status: "LOBBY",
      maxPlayers: config.maxPlayers,
      callInterval: config.callInterval,
      createdAt: new Date().toISOString()
    };

    this.rooms.set(room.id, room);
    return room;
  }

  getByRoomCode(roomCode: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.roomCode === roomCode) {
        return room;
      }
    }

    return null;
  }
}
