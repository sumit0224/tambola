export const claimTypes = [
  "TOP_ROW",
  "MIDDLE_ROW",
  "BOTTOM_ROW",
  "EARLY_FIVE",
  "FULL_HOUSE"
] as const;

export type ClaimType = (typeof claimTypes)[number];

export type Winner = {
  claimType: ClaimType;
  winner: {
    userId: string;
    displayName: string;
  };
};
