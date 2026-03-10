export type GridCell = number | null;
export type TicketGrid = GridCell[][];

export type Ticket = {
  id: string;
  roomId: string;
  userId: string;
  grid: TicketGrid;
  createdAt: string;
};
