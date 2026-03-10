import type { TicketGrid } from "./ticket.types";

const BANDS: [number, number][] = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90]
];

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function combinationsOfRows(size: 1 | 2 | 3): number[][] {
  if (size === 1) {
    return [[0], [1], [2]];
  }

  if (size === 2) {
    return [
      [0, 1],
      [0, 2],
      [1, 2]
    ];
  }

  return [[0, 1, 2]];
}

function pickColumnCounts(): number[] {
  const counts = Array(9).fill(1);
  let extras = 6;

  while (extras > 0) {
    const col = randomInt(9);
    if (counts[col] < 3) {
      counts[col] += 1;
      extras -= 1;
    }
  }

  return counts;
}

function assignRowsForColumns(colCounts: number[]): number[][] {
  const rowFill = [0, 0, 0];
  const assignment: number[][] = Array.from({ length: 9 }, () => []);

  const search = (col: number): boolean => {
    if (col === 9) {
      return rowFill.every((count) => count === 5);
    }

    const combos = shuffle(combinationsOfRows(colCounts[col] as 1 | 2 | 3).slice());
    for (const combo of combos) {
      if (combo.some((row) => rowFill[row] >= 5)) {
        continue;
      }

      combo.forEach((row) => {
        rowFill[row] += 1;
      });

      const remainingColumns = 9 - col - 1;
      const remainingNumbers = colCounts.slice(col + 1).reduce((sum, count) => sum + count, 0);
      const remainingCapacity = rowFill.reduce((sum, count) => sum + (5 - count), 0);

      const feasible =
        rowFill.every((count) => count <= 5 && count + remainingColumns >= 5) &&
        remainingCapacity === remainingNumbers;

      if (feasible) {
        assignment[col] = combo;
        if (search(col + 1)) {
          return true;
        }
      }

      combo.forEach((row) => {
        rowFill[row] -= 1;
      });
      assignment[col] = [];
    }

    return false;
  };

  if (!search(0)) {
    throw new Error("Failed to assign rows for ticket generation");
  }

  return assignment;
}

function sampleDistinct(min: number, max: number, count: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, idx) => min + idx);
  shuffle(pool);
  return pool.slice(0, count).sort((a, b) => a - b);
}

function validateGrid(grid: TicketGrid): void {
  const rowCounts = grid.map((row) => row.filter((value) => value !== null).length);
  if (!rowCounts.every((count) => count === 5)) {
    throw new Error("Each ticket row must contain exactly 5 numbers");
  }

  for (let col = 0; col < 9; col += 1) {
    const columnValues = [grid[0][col], grid[1][col], grid[2][col]].filter(
      (value): value is number => value !== null
    );

    if (columnValues.length < 1 || columnValues.length > 3) {
      throw new Error("Column count must be between 1 and 3");
    }

    const sorted = columnValues.slice().sort((a, b) => a - b);
    if (!columnValues.every((value, idx) => value === sorted[idx])) {
      throw new Error("Column values must be sorted ascending from top to bottom");
    }
  }
}

export function generateTicketGrid(): TicketGrid {
  const grid: TicketGrid = Array.from({ length: 3 }, () => Array(9).fill(null));
  const columnCounts = pickColumnCounts();
  const rowAssignment = assignRowsForColumns(columnCounts);

  for (let col = 0; col < 9; col += 1) {
    const [min, max] = BANDS[col];
    const colNumbers = sampleDistinct(min, max, columnCounts[col]);
    const rows = rowAssignment[col].slice().sort((a, b) => a - b);

    rows.forEach((row, idx) => {
      grid[row][col] = colNumbers[idx];
    });
  }

  validateGrid(grid);
  return grid;
}
