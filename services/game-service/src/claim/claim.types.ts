export const claimTypeValues = ["TOP_ROW", "MIDDLE_ROW", "BOTTOM_ROW", "EARLY_FIVE", "FULL_HOUSE"] as const;

export type ClaimType = (typeof claimTypeValues)[number];

export type ClaimResult = {
  status: "VALID" | "INVALID";
  claimType: ClaimType;
  reason?: string;
};
