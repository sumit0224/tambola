import type { ClaimResult, ClaimType } from "./claim.types";
import type { TicketGrid } from "../ticket/ticket.types";

export class ClaimValidator {
  validate(grid: TicketGrid, calledNumbers: Set<number>, claimType: ClaimType): ClaimResult {
    if (grid.length !== 3 || grid.some((row) => row.length !== 9)) {
      return {
        status: "INVALID",
        claimType,
        reason: "Invalid ticket format"
      };
    }

    const rowNumbers = (row: number) => grid[row].filter((value): value is number => value !== null);
    const allCalled = (nums: number[]) => nums.every((num) => calledNumbers.has(num));

    switch (claimType) {
      case "TOP_ROW": {
        const nums = rowNumbers(0);
        if (!allCalled(nums)) {
          return { status: "INVALID", claimType, reason: "Top row not complete" };
        }
        return { status: "VALID", claimType };
      }
      case "MIDDLE_ROW": {
        const nums = rowNumbers(1);
        if (!allCalled(nums)) {
          return { status: "INVALID", claimType, reason: "Middle row not complete" };
        }
        return { status: "VALID", claimType };
      }
      case "BOTTOM_ROW": {
        const nums = rowNumbers(2);
        if (!allCalled(nums)) {
          return { status: "INVALID", claimType, reason: "Bottom row not complete" };
        }
        return { status: "VALID", claimType };
      }
      case "EARLY_FIVE": {
        const markedCount = grid.flat().filter((n): n is number => n !== null && calledNumbers.has(n)).length;
        if (markedCount < 5) {
          return { status: "INVALID", claimType, reason: "Five numbers are not marked yet" };
        }
        return { status: "VALID", claimType };
      }
      case "FULL_HOUSE": {
        const allNumbers = grid.flat().filter((n): n is number => n !== null);
        if (!allCalled(allNumbers)) {
          return { status: "INVALID", claimType, reason: "Full house is not complete" };
        }
        return { status: "VALID", claimType };
      }
    }
  }
}
