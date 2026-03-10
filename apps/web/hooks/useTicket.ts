"use client";

import { useState } from "react";

export type TicketGridState = (number | null)[][];

export function useTicket(initialGrid: TicketGridState) {
  const [grid, setGrid] = useState(initialGrid);

  return {
    grid,
    setGrid
  };
}
