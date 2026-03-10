import crypto from "node:crypto";
import { generateTicketGrid } from "./ticketGenerator";
import type { Ticket } from "./ticket.types";

export class TicketService {
  generate(roomId: string, userId: string): Ticket {
    return {
      id: crypto.randomUUID(),
      roomId,
      userId,
      grid: generateTicketGrid(),
      createdAt: new Date().toISOString()
    };
  }

  generateUnique(roomId: string, userId: string, roomTicketHashes: Set<string>): Ticket {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const ticket = this.generate(roomId, userId);
      const hash = JSON.stringify(ticket.grid);
      if (!roomTicketHashes.has(hash)) {
        roomTicketHashes.add(hash);
        return ticket;
      }
    }

    throw new Error("Failed to generate a unique ticket after multiple attempts");
  }
}
