"use client";

import { useState } from "react";

export function useGame() {
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);

  return {
    calledNumbers,
    addCalledNumber: (number: number) => setCalledNumbers((prev) => [...prev, number])
  };
}
